/// Moby — Autonomous Agent Wallet
/// =================================
/// `moby_policy` is the on-chain guardrail that lets a wallet owner delegate
/// REAL trade execution to an autonomous agent without surrendering custody.
///
/// The owner escrows funds into the policy's `vault`. The agent can move those
/// funds ONLY through `agent_swap` — a single fund-exit door that swaps on a
/// specific DeepBook pool, gated in Move by five checks: agent identity, the
/// kill-switch, an expiry, a pool allow-scope, and the spend ceiling. No path
/// lets the agent exceed the budget, trade a different pool, act after expiry,
/// or move funds once revoked.
module moby::moby_policy;

use sui::balance::{Self, Balance};
use sui::coin::{Self, Coin};
use sui::sui::SUI;
use sui::clock::Clock;
use sui::event;
use deepbook::pool::{Self, Pool};
use token::deep::DEEP;

// ─── Errors ──────────────────────────────────────────────────────────────

/// Caller is not the policy `owner`.
const ENotOwner: u64 = 0;
/// Caller is not the delegated `agent`.
const ENotAgent: u64 = 1;
/// The policy has been revoked by its owner; the agent is severed.
const EPolicyRevoked: u64 = 2;
/// The spend would push `amount_spent` past `allowance_limit`.
const EBudgetExceeded: u64 = 3;
/// A zero amount was supplied where a positive value is required.
const EZeroAmount: u64 = 4;
/// The policy's time window has elapsed (`now >= expires_at_ms`).
const EPolicyExpired: u64 = 5;
/// The pool passed to `agent_swap` is not the policy's `allowed_pool`.
const EPoolNotAllowed: u64 = 6;
/// The swap returned less base than the caller's `min_base_out` floor.
const ESlippage: u64 = 7;

// ─── Objects ─────────────────────────────────────────────────────────────

/// The capped-budget capability governing one owner → agent relationship.
/// Shared on creation; the owner escrows `vault` (the quote asset, SUI) and the
/// agent draws from it strictly through `agent_swap`.
public struct AgentPolicy has key, store {
    id: UID,
    /// Wallet that owns the funds and holds revoke / top-up authority.
    owner: address,
    /// Delegated executor permitted to swap within budget.
    agent: address,
    /// Hard ceiling on cumulative quote (SUI) the agent may spend.
    allowance_limit: u64,
    /// Cumulative quote spent against the ceiling.
    amount_spent: u64,
    /// Kill-switch. `false` permanently severs the agent.
    is_active: bool,
    /// Epoch-ms after which `agent_swap` aborts (`EPolicyExpired`).
    expires_at_ms: u64,
    /// The only DeepBook pool the agent may trade against.
    allowed_pool: ID,
    /// Escrowed quote asset the agent spends. Funds never leave except via swap.
    vault: Balance<SUI>,
}

// ─── Events ──────────────────────────────────────────────────────────────

public struct PolicyCreated has copy, drop {
    policy_id: ID,
    owner: address,
    agent: address,
    allowance_limit: u64,
    allowed_pool: ID,
    expires_at_ms: u64,
}

public struct PolicyRevoked has copy, drop {
    policy_id: ID,
    owner: address,
}

public struct AllowanceToppedUp has copy, drop {
    policy_id: ID,
    added: u64,
    new_limit: u64,
}

/// Emitted when the owner reclaims escrowed SUI from the vault.
public struct Withdrawn has copy, drop {
    policy_id: ID,
    owner: address,
    amount: u64,
    vault_remaining: u64,
}

/// Emitted on every real swap — the on-chain activity record (replaces the old
/// counter-only `record_spend`). `base_out` proves funds actually moved.
public struct SpendRecorded has copy, drop {
    policy_id: ID,
    agent: address,
    amount_in: u64,
    base_out: u64,
    amount_spent: u64,
    remaining: u64,
}

// ─── Entry: lifecycle ──────────────────────────────────────────────────────

/// Deploy a policy delegating `agent` to trade `allowed_pool` for `duration_ms`,
/// escrowing `funds` (SUI) as the spendable budget. The escrowed amount IS the
/// ceiling. Caller becomes owner. Shared so the agent can transact against it.
public fun create_policy(
    agent: address,
    allowed_pool: ID,
    duration_ms: u64,
    funds: Coin<SUI>,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    let allowance_limit = coin::value(&funds);
    assert!(allowance_limit > 0, EZeroAmount);

    let policy = AgentPolicy {
        id: object::new(ctx),
        owner: ctx.sender(),
        agent,
        allowance_limit,
        amount_spent: 0,
        is_active: true,
        expires_at_ms: clock.timestamp_ms() + duration_ms,
        allowed_pool,
        vault: coin::into_balance(funds),
    };

    event::emit(PolicyCreated {
        policy_id: object::id(&policy),
        owner: policy.owner,
        agent: policy.agent,
        allowance_limit,
        allowed_pool,
        expires_at_ms: policy.expires_at_ms,
    });

    transfer::share_object(policy);
}

/// Owner-only kill-switch. Idempotent flip to inactive; the agent is severed for
/// good (a fresh policy must be created to re-delegate).
public fun revoke_policy(policy: &mut AgentPolicy, ctx: &TxContext) {
    assert!(ctx.sender() == policy.owner, ENotOwner);

    policy.is_active = false;

    event::emit(PolicyRevoked {
        policy_id: object::id(policy),
        owner: policy.owner,
    });
}

/// Owner-only top-up: escrow more SUI and raise the ceiling by the same amount.
public fun top_up_allowance(
    policy: &mut AgentPolicy,
    funds: Coin<SUI>,
    ctx: &TxContext,
) {
    assert!(ctx.sender() == policy.owner, ENotOwner);
    let added = coin::value(&funds);
    assert!(added > 0, EZeroAmount);

    balance::join(&mut policy.vault, coin::into_balance(funds));
    policy.allowance_limit = policy.allowance_limit + added;

    event::emit(AllowanceToppedUp {
        policy_id: object::id(policy),
        added,
        new_limit: policy.allowance_limit,
    });
}

/// Owner-only: reclaim `amount` of escrowed SUI from the vault back to the owner.
/// Escrowed funds are never locked — the owner can always retrieve what the agent
/// has not spent (e.g. dust below the pool's minimum order size). The ceiling is
/// re-pegged to the reduced vault so `remaining` stays honest.
public fun withdraw_unspent(
    policy: &mut AgentPolicy,
    amount: u64,
    ctx: &mut TxContext,
) {
    assert!(ctx.sender() == policy.owner, ENotOwner);
    assert!(amount > 0, EZeroAmount);

    let c = coin::take(&mut policy.vault, amount, ctx);
    let left = balance::value(&policy.vault);
    // Keep the ceiling honest: remaining headroom now mirrors the reduced vault.
    policy.allowance_limit = policy.amount_spent + left;

    event::emit(Withdrawn {
        policy_id: object::id(policy),
        owner: policy.owner,
        amount,
        vault_remaining: left,
    });

    transfer::public_transfer(c, policy.owner);
}

/// Owner-only: drain the entire vault back to the owner and sever the agent in
/// one call (a permanent close). Combines a full `withdraw` + `revoke`.
public fun close_policy(policy: &mut AgentPolicy, ctx: &mut TxContext) {
    assert!(ctx.sender() == policy.owner, ENotOwner);

    let amount = balance::value(&policy.vault);
    if (amount > 0) {
        let c = coin::take(&mut policy.vault, amount, ctx);
        transfer::public_transfer(c, policy.owner);
    };
    policy.is_active = false;
    policy.allowance_limit = policy.amount_spent; // remaining = 0

    event::emit(Withdrawn {
        policy_id: object::id(policy),
        owner: policy.owner,
        amount,
        vault_remaining: 0,
    });
    event::emit(PolicyRevoked {
        policy_id: object::id(policy),
        owner: policy.owner,
    });
}

// ─── The single fund-exit door ──────────────────────────────────────────────

/// All five spend checks, factored out so they are unit-testable without a live
/// DeepBook `Pool`: pass the pool id, current time, amount, and sender directly.
/// `agent_swap` calls this with the real pool/clock/sender before any funds move.
public fun assert_spend_allowed(
    policy: &AgentPolicy,
    pool_id: ID,
    now_ms: u64,
    amount: u64,
    sender: address,
) {
    assert!(sender == policy.agent, ENotAgent);
    assert!(policy.is_active, EPolicyRevoked);
    assert!(amount > 0, EZeroAmount);
    assert!(now_ms < policy.expires_at_ms, EPolicyExpired);
    assert!(pool_id == policy.allowed_pool, EPoolNotAllowed);
    assert!(
        policy.amount_spent + amount <= policy.allowance_limit,
        EBudgetExceeded,
    );
}

/// Agent-only: spend `amount` of escrowed SUI to buy `Base` on the allowed pool
/// via a real DeepBook taker swap. This is the ONLY way funds leave the vault.
/// Reverts unless every `assert_spend_allowed` check passes; the swap output is
/// floored by `min_base_out` (slippage). `min_base_out` is computed off-chain
/// from DeepBook's `get_quantity_out`. The bought base goes to the owner;
/// unfilled quote returns to the vault.
public fun agent_swap<Base>(
    policy: &mut AgentPolicy,
    pool: &mut Pool<Base, SUI>,
    amount: u64,
    min_base_out: u64,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    assert_spend_allowed(
        policy,
        object::id(pool),
        clock.timestamp_ms(),
        amount,
        ctx.sender(),
    );

    // Draw exactly `amount` quote from the vault; fee is paid from input, so the
    // agent never needs to hold DEEP (zero coin works on whitelisted pools).
    let quote_in = coin::take(&mut policy.vault, amount, ctx);
    let deep_zero = coin::zero<DEEP>(ctx);

    let (base_out, quote_leftover, deep_leftover) =
        pool::swap_exact_quote_for_base<Base, SUI>(
            pool,
            quote_in,
            deep_zero,
            min_base_out,
            clock,
            ctx,
        );

    // Explicit slippage floor (belt-and-suspenders over DeepBook's own check).
    assert!(coin::value(&base_out) >= min_base_out, ESlippage);

    policy.amount_spent = policy.amount_spent + amount;
    let base_got = coin::value(&base_out);

    event::emit(SpendRecorded {
        policy_id: object::id(policy),
        agent: policy.agent,
        amount_in: amount,
        base_out: base_got,
        amount_spent: policy.amount_spent,
        remaining: policy.allowance_limit - policy.amount_spent,
    });

    // Unfilled quote returns to the vault; bought base + any leftover DEEP route
    // to the owner. Funds only ever land with the owner — never the agent.
    balance::join(&mut policy.vault, coin::into_balance(quote_leftover));
    transfer::public_transfer(base_out, policy.owner);
    if (coin::value(&deep_leftover) == 0) {
        coin::destroy_zero(deep_leftover);
    } else {
        transfer::public_transfer(deep_leftover, policy.owner);
    };
}

// ─── Views ───────────────────────────────────────────────────────────────

/// Remaining headroom under the ceiling, saturating at zero.
public fun remaining(policy: &AgentPolicy): u64 {
    if (policy.allowance_limit > policy.amount_spent) {
        policy.allowance_limit - policy.amount_spent
    } else {
        0
    }
}

public fun owner(policy: &AgentPolicy): address { policy.owner }

public fun agent(policy: &AgentPolicy): address { policy.agent }

public fun allowance_limit(policy: &AgentPolicy): u64 { policy.allowance_limit }

public fun amount_spent(policy: &AgentPolicy): u64 { policy.amount_spent }

public fun is_active(policy: &AgentPolicy): bool { policy.is_active }

public fun expires_at_ms(policy: &AgentPolicy): u64 { policy.expires_at_ms }

public fun allowed_pool(policy: &AgentPolicy): ID { policy.allowed_pool }

public fun vault_balance(policy: &AgentPolicy): u64 { balance::value(&policy.vault) }

// ─── Tests ───────────────────────────────────────────────────────────────
// The swap itself is verified on-chain (a real `agent_swap` tx with two-way
// balanceChanges). These unit tests cover the authority/guard logic in
// isolation via `assert_spend_allowed`, so they need no live DeepBook pool.

#[test_only]
use sui::test_scenario as ts;
#[test_only]
use sui::clock;

#[test_only]
const OWNER: address = @0xA;
#[test_only]
const AGENT: address = @0xB;
#[test_only]
const POOL: address = @0xC0FFEE;
#[test_only]
const OTHER_POOL: address = @0xBADBAD;

#[test_only]
/// Mint `amt` SUI and create a 10s policy delegating AGENT to trade POOL.
fun new_policy(sc: &mut ts::Scenario, amt: u64) {
    let ctx = sc.ctx();
    let c = clock::create_for_testing(ctx);
    let funds = coin::mint_for_testing<SUI>(amt, ctx);
    create_policy(AGENT, object::id_from_address(POOL), 10_000, funds, &c, ctx);
    clock::destroy_for_testing(c);
}

#[test]
fun guard_passes_for_agent_within_budget() {
    let mut sc = ts::begin(OWNER);
    new_policy(&mut sc, 1_000);

    sc.next_tx(AGENT);
    {
        let policy = sc.take_shared<AgentPolicy>();
        // now_ms within window, correct pool, within budget, correct agent.
        assert_spend_allowed(
            &policy,
            object::id_from_address(POOL),
            5_000,
            500,
            AGENT,
        );
        assert!(policy.allowance_limit() == 1_000, 0);
        assert!(policy.vault_balance() == 1_000, 1);
        ts::return_shared(policy);
    };
    sc.end();
}

#[test]
#[expected_failure(abort_code = EPolicyExpired)]
fun guard_aborts_after_expiry() {
    let mut sc = ts::begin(OWNER);
    new_policy(&mut sc, 1_000); // expires_at_ms = 10_000

    sc.next_tx(AGENT);
    {
        let policy = sc.take_shared<AgentPolicy>();
        // now_ms past the window → EPolicyExpired.
        assert_spend_allowed(
            &policy,
            object::id_from_address(POOL),
            10_001,
            100,
            AGENT,
        );
        ts::return_shared(policy);
    };
    sc.end();
}

#[test]
#[expected_failure(abort_code = EPoolNotAllowed)]
fun guard_aborts_on_wrong_pool() {
    let mut sc = ts::begin(OWNER);
    new_policy(&mut sc, 1_000);

    sc.next_tx(AGENT);
    {
        let policy = sc.take_shared<AgentPolicy>();
        // A different pool than allowed_pool → EPoolNotAllowed.
        assert_spend_allowed(
            &policy,
            object::id_from_address(OTHER_POOL),
            5_000,
            100,
            AGENT,
        );
        ts::return_shared(policy);
    };
    sc.end();
}

#[test]
#[expected_failure(abort_code = EBudgetExceeded)]
fun guard_aborts_over_ceiling() {
    let mut sc = ts::begin(OWNER);
    new_policy(&mut sc, 1_000);

    sc.next_tx(AGENT);
    {
        let policy = sc.take_shared<AgentPolicy>();
        assert_spend_allowed(
            &policy,
            object::id_from_address(POOL),
            5_000,
            1_001, // > allowance_limit
            AGENT,
        );
        ts::return_shared(policy);
    };
    sc.end();
}

#[test]
#[expected_failure(abort_code = ENotAgent)]
fun guard_rejects_non_agent() {
    let mut sc = ts::begin(OWNER);
    new_policy(&mut sc, 1_000);

    sc.next_tx(OWNER);
    {
        let policy = sc.take_shared<AgentPolicy>();
        assert_spend_allowed(
            &policy,
            object::id_from_address(POOL),
            5_000,
            100,
            OWNER, // not the delegated agent
        );
        ts::return_shared(policy);
    };
    sc.end();
}

#[test]
#[expected_failure(abort_code = EPolicyRevoked)]
fun guard_aborts_after_revoke() {
    let mut sc = ts::begin(OWNER);
    new_policy(&mut sc, 1_000);

    sc.next_tx(OWNER);
    {
        let mut policy = sc.take_shared<AgentPolicy>();
        revoke_policy(&mut policy, sc.ctx());
        assert_spend_allowed(
            &policy,
            object::id_from_address(POOL),
            5_000,
            100,
            AGENT,
        );
        ts::return_shared(policy);
    };
    sc.end();
}

#[test]
#[expected_failure(abort_code = ENotOwner)]
fun agent_cannot_revoke() {
    let mut sc = ts::begin(OWNER);
    new_policy(&mut sc, 1_000);

    sc.next_tx(AGENT);
    {
        let mut policy = sc.take_shared<AgentPolicy>();
        revoke_policy(&mut policy, sc.ctx());
        ts::return_shared(policy);
    };
    sc.end();
}

#[test]
fun top_up_grows_vault_and_ceiling() {
    let mut sc = ts::begin(OWNER);
    new_policy(&mut sc, 1_000);

    sc.next_tx(OWNER);
    {
        let mut policy = sc.take_shared<AgentPolicy>();
        let more = coin::mint_for_testing<SUI>(250, sc.ctx());
        top_up_allowance(&mut policy, more, sc.ctx());
        assert!(policy.allowance_limit() == 1_250, 0);
        assert!(policy.vault_balance() == 1_250, 1);
        ts::return_shared(policy);
    };
    sc.end();
}

#[test]
fun owner_withdraws_unspent_and_ceiling_stays_honest() {
    let mut sc = ts::begin(OWNER);
    new_policy(&mut sc, 1_000);

    sc.next_tx(OWNER);
    {
        let mut policy = sc.take_shared<AgentPolicy>();
        withdraw_unspent(&mut policy, 400, sc.ctx());
        assert!(policy.vault_balance() == 600, 0);
        // amount_spent is 0, so ceiling re-pegs to the remaining vault.
        assert!(policy.allowance_limit() == 600, 1);
        assert!(policy.remaining() == 600, 2);
        ts::return_shared(policy);
    };
    // The reclaimed SUI lands as a coin owned by the owner.
    sc.next_tx(OWNER);
    {
        let coin = sc.take_from_sender<sui::coin::Coin<SUI>>();
        assert!(coin.value() == 400, 3);
        sc.return_to_sender(coin);
    };
    sc.end();
}

#[test]
#[expected_failure(abort_code = ENotOwner)]
fun agent_cannot_withdraw() {
    let mut sc = ts::begin(OWNER);
    new_policy(&mut sc, 1_000);

    sc.next_tx(AGENT);
    {
        let mut policy = sc.take_shared<AgentPolicy>();
        withdraw_unspent(&mut policy, 100, sc.ctx());
        ts::return_shared(policy);
    };
    sc.end();
}

#[test]
fun close_policy_drains_and_revokes() {
    let mut sc = ts::begin(OWNER);
    new_policy(&mut sc, 1_000);

    sc.next_tx(OWNER);
    {
        let mut policy = sc.take_shared<AgentPolicy>();
        close_policy(&mut policy, sc.ctx());
        assert!(policy.vault_balance() == 0, 0);
        assert!(policy.remaining() == 0, 1);
        assert!(!policy.is_active(), 2);
        ts::return_shared(policy);
    };
    sc.next_tx(OWNER);
    {
        let coin = sc.take_from_sender<sui::coin::Coin<SUI>>();
        assert!(coin.value() == 1_000, 3);
        sc.return_to_sender(coin);
    };
    sc.end();
}
