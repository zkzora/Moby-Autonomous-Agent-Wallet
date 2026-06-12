/// Moby — Autonomous Agent Wallet
/// =================================
/// `moby_policy` is the on-chain guardrail that lets a wallet owner delegate
/// trade execution to an autonomous agent without ever surrendering custody.
///
/// The `AgentPolicy` object is the "Capped Budget Ceiling" and the
/// "Kill-Switch" in one:
///   * a hard `allowance_limit` the agent can never spend past, and
///   * an `is_active` flag the owner can flip to sever the agent instantly.
///
/// Design — object-centric, least authority:
///   * The policy is a *shared* object so the agent (a distinct address) can
///     transact against it autonomously, while the Move layer gates every
///     mutation on `ctx.sender()`.
///   * The owner alone can revoke or top up. The agent alone can record spend,
///     and only inside the active budget. No path lets the agent move funds
///     beyond the ceiling or resurrect a revoked policy.
module moby::moby_policy;

use sui::event;

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

// ─── Objects ─────────────────────────────────────────────────────────────

/// The capped-budget capability governing one owner → agent relationship.
/// Shared on creation; mutations are authority-checked against `ctx.sender()`.
public struct AgentPolicy has key, store {
    id: UID,
    /// Wallet that owns the funds and holds revoke / top-up authority.
    owner: address,
    /// Delegated executor permitted to record spend within budget.
    agent: address,
    /// Hard ceiling, in the smallest unit (e.g. MIST for SUI, 1e6 for USDC).
    allowance_limit: u64,
    /// Cumulative amount the agent has recorded against the ceiling.
    amount_spent: u64,
    /// Kill-switch. `false` permanently severs the agent.
    is_active: bool,
}

// ─── Events ──────────────────────────────────────────────────────────────
// Emitted for off-chain indexers (the Moby dashboard subscribes to these).

public struct PolicyCreated has copy, drop {
    policy_id: ID,
    owner: address,
    agent: address,
    allowance_limit: u64,
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

public struct SpendRecorded has copy, drop {
    policy_id: ID,
    agent: address,
    amount: u64,
    amount_spent: u64,
    remaining: u64,
}

public struct PolicyReset has copy, drop {
    policy_id: ID,
    owner: address,
    allowance_limit: u64,
}

// ─── Entry: lifecycle ────────────────────────────────────────────────────

/// Deploy a new policy delegating `agent` an `allowance_limit` ceiling.
/// The caller becomes the owner. The policy is shared so the agent can later
/// transact against it; authority stays enforced in Move.
public fun create_policy(
    agent: address,
    allowance_limit: u64,
    ctx: &mut TxContext,
) {
    assert!(allowance_limit > 0, EZeroAmount);

    let policy = AgentPolicy {
        id: object::new(ctx),
        owner: ctx.sender(),
        agent,
        allowance_limit,
        amount_spent: 0,
        is_active: true,
    };

    event::emit(PolicyCreated {
        policy_id: object::id(&policy),
        owner: policy.owner,
        agent: policy.agent,
        allowance_limit,
    });

    transfer::share_object(policy);
}

/// Owner-only kill-switch. Idempotent flip to inactive; the agent is severed
/// for good (a fresh policy must be created to re-delegate).
public fun revoke_policy(policy: &mut AgentPolicy, ctx: &TxContext) {
    assert!(ctx.sender() == policy.owner, ENotOwner);

    policy.is_active = false;

    event::emit(PolicyRevoked {
        policy_id: object::id(policy),
        owner: policy.owner,
    });
}

/// Owner-only ceiling increase. The agent's headroom grows by `amount`.
/// Permitted even while inactive so an owner can prepare, then re-create;
/// it never reactivates a revoked policy on its own.
public fun top_up_allowance(
    policy: &mut AgentPolicy,
    amount: u64,
    ctx: &TxContext,
) {
    assert!(ctx.sender() == policy.owner, ENotOwner);
    assert!(amount > 0, EZeroAmount);

    policy.allowance_limit = policy.allowance_limit + amount;

    event::emit(AllowanceToppedUp {
        policy_id: object::id(policy),
        added: amount,
        new_limit: policy.allowance_limit,
    });
}

/// Owner-only reset: zero the spent counter and set the new ceiling to `extra`.
/// Pass 0 to fully reset allowance (agent rests until the owner tops up again).
/// Pass a positive value to reset and immediately open a new budget in one call.
/// Only an *active* policy can be reset; a revoked one stays severed.
public fun reset_policy(
    policy: &mut AgentPolicy,
    extra: u64,
    ctx: &TxContext,
) {
    assert!(ctx.sender() == policy.owner, ENotOwner);
    assert!(policy.is_active, EPolicyRevoked);

    policy.amount_spent = 0;
    policy.allowance_limit = extra;

    event::emit(PolicyReset {
        policy_id: object::id(policy),
        owner: policy.owner,
        allowance_limit: policy.allowance_limit,
    });
}

/// Agent-only spend record. Reverts unless the caller is the delegated agent,
/// the policy is active, and the spend fits under the ceiling. This is the
/// single chokepoint that enforces the budget on chain.
public fun record_spend(
    policy: &mut AgentPolicy,
    amount: u64,
    ctx: &TxContext,
) {
    assert!(ctx.sender() == policy.agent, ENotAgent);
    assert!(policy.is_active, EPolicyRevoked);
    assert!(amount > 0, EZeroAmount);
    assert!(
        policy.amount_spent + amount <= policy.allowance_limit,
        EBudgetExceeded,
    );

    policy.amount_spent = policy.amount_spent + amount;

    event::emit(SpendRecorded {
        policy_id: object::id(policy),
        agent: policy.agent,
        amount,
        amount_spent: policy.amount_spent,
        remaining: policy.allowance_limit - policy.amount_spent,
    });
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

// ─── Tests ───────────────────────────────────────────────────────────────

#[test_only]
use sui::test_scenario as ts;

#[test_only]
const OWNER: address = @0xA;
#[test_only]
const AGENT: address = @0xB;

#[test]
fun create_then_spend_within_budget() {
    let mut sc = ts::begin(OWNER);
    create_policy(AGENT, 500, sc.ctx());

    sc.next_tx(AGENT);
    {
        let mut policy = sc.take_shared<AgentPolicy>();
        record_spend(&mut policy, 200, sc.ctx());
        assert!(policy.amount_spent() == 200, 0);
        assert!(policy.remaining() == 300, 1);
        ts::return_shared(policy);
    };
    sc.end();
}

#[test]
fun reset_clears_spend_and_can_top_up() {
    let mut sc = ts::begin(OWNER);
    create_policy(AGENT, 100, sc.ctx());

    sc.next_tx(AGENT);
    {
        let mut policy = sc.take_shared<AgentPolicy>();
        record_spend(&mut policy, 100, sc.ctx()); // exhaust the ceiling
        assert!(policy.remaining() == 0, 0);
        ts::return_shared(policy);
    };

    sc.next_tx(OWNER);
    {
        let mut policy = sc.take_shared<AgentPolicy>();
        reset_policy(&mut policy, 50, sc.ctx()); // clear spend, new ceiling = extra
        assert!(policy.amount_spent() == 0, 1);
        assert!(policy.allowance_limit() == 50, 2); // ceiling set to extra, not added
        assert!(policy.remaining() == 50, 3);
        assert!(policy.is_active(), 4);
        ts::return_shared(policy);
    };
    sc.end();
}

#[test]
#[expected_failure(abort_code = ENotOwner)]
fun agent_cannot_reset() {
    let mut sc = ts::begin(OWNER);
    create_policy(AGENT, 100, sc.ctx());

    sc.next_tx(AGENT);
    {
        let mut policy = sc.take_shared<AgentPolicy>();
        reset_policy(&mut policy, 0, sc.ctx());
        ts::return_shared(policy);
    };
    sc.end();
}

#[test]
#[expected_failure(abort_code = EPolicyRevoked)]
fun reset_after_revoke_aborts() {
    let mut sc = ts::begin(OWNER);
    create_policy(AGENT, 100, sc.ctx());

    sc.next_tx(OWNER);
    {
        let mut policy = sc.take_shared<AgentPolicy>();
        revoke_policy(&mut policy, sc.ctx());
        reset_policy(&mut policy, 0, sc.ctx()); // kill-switch is permanent
        ts::return_shared(policy);
    };
    sc.end();
}

#[test]
#[expected_failure(abort_code = EBudgetExceeded)]
fun spend_past_ceiling_aborts() {
    let mut sc = ts::begin(OWNER);
    create_policy(AGENT, 100, sc.ctx());

    sc.next_tx(AGENT);
    {
        let mut policy = sc.take_shared<AgentPolicy>();
        record_spend(&mut policy, 101, sc.ctx());
        ts::return_shared(policy);
    };
    sc.end();
}

#[test]
#[expected_failure(abort_code = EPolicyRevoked)]
fun spend_after_revoke_aborts() {
    let mut sc = ts::begin(OWNER);
    create_policy(AGENT, 500, sc.ctx());

    sc.next_tx(OWNER);
    {
        let mut policy = sc.take_shared<AgentPolicy>();
        revoke_policy(&mut policy, sc.ctx());
        ts::return_shared(policy);
    };

    sc.next_tx(AGENT);
    {
        let mut policy = sc.take_shared<AgentPolicy>();
        record_spend(&mut policy, 1, sc.ctx());
        ts::return_shared(policy);
    };
    sc.end();
}

#[test]
#[expected_failure(abort_code = ENotAgent)]
fun owner_cannot_record_spend() {
    let mut sc = ts::begin(OWNER);
    create_policy(AGENT, 500, sc.ctx());

    sc.next_tx(OWNER);
    {
        let mut policy = sc.take_shared<AgentPolicy>();
        record_spend(&mut policy, 10, sc.ctx());
        ts::return_shared(policy);
    };
    sc.end();
}

#[test]
#[expected_failure(abort_code = ENotOwner)]
fun agent_cannot_revoke() {
    let mut sc = ts::begin(OWNER);
    create_policy(AGENT, 500, sc.ctx());

    sc.next_tx(AGENT);
    {
        let mut policy = sc.take_shared<AgentPolicy>();
        revoke_policy(&mut policy, sc.ctx());
        ts::return_shared(policy);
    };
    sc.end();
}

#[test]
fun top_up_raises_ceiling() {
    let mut sc = ts::begin(OWNER);
    create_policy(AGENT, 500, sc.ctx());

    sc.next_tx(OWNER);
    {
        let mut policy = sc.take_shared<AgentPolicy>();
        top_up_allowance(&mut policy, 250, sc.ctx());
        assert!(policy.allowance_limit() == 750, 0);
        ts::return_shared(policy);
    };
    sc.end();
}
