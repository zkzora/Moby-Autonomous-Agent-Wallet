# moby_policy — Move package

The on-chain guardrail for Moby's autonomous agent wallet: a shared
`AgentPolicy` object that escrows the owner's funds and lets a delegated agent
spend them **only** through `agent_swap` — a real DeepBook taker swap gated in
Move by five checks (agent identity, kill-switch, expiry, pool allow-scope, and
the spend ceiling).

## Layout

```
packages/move/
├── Move.toml
├── scripts/
│   └── fix-deepbook-published-at.sh
└── sources/
    └── moby_policy.move
```

## Build & test

```bash
cd packages/move
sui move build
sui move test
```

The suite covers the authority/guard logic in isolation via `assert_spend_allowed`
(agent-only, kill-switch, expiry → `EPolicyExpired`, pool-scope →
`EPoolNotAllowed`, ceiling → `EBudgetExceeded`, owner-only revoke) plus top-up.
It needs **no live DeepBook pool** — the swap itself is verified on-chain (a real
`agent_swap` tx with two-way balanceChanges + DeepBook `OrderFilled` +
`SpendRecorded`).

## DeepBook dependency — IMPORTANT for publishing

`agent_swap` calls `deepbook::pool::swap_exact_quote_for_base`. The `deepbook`
git dependency is pinned to an exact commit, but its committed `Published.toml`
records the testnet deploy as **v19 (`0x74cd56…`)**, which DeepBook has since
**disabled on-chain**. The live, active testnet package is **`0x22be4c…`** (a
v20 deploy not yet committed to the public deepbookv3 repo).

- **Build / test:** work as-is — they bind to the unchanging type-origin
  (`0xfb28c4…`) and never execute a live swap.
- **Publish:** the dependency's `published-at` is linked into the on-chain
  package. Left at v19, every `agent_swap` aborts in `pool::load_inner`
  (code 11, version disabled). Re-point it to the active version first:

```bash
sui move build                          # fetch the dependency
./scripts/fix-deepbook-published-at.sh  # re-point published-at → 0x22be4c… (idempotent)
sui client publish --gas-budget 200000000
```

## Publish to testnet

```bash
sui client switch --env testnet
sui client faucet                       # need ~2 SUI (escrow + gas)
sui move build && ./scripts/fix-deepbook-published-at.sh
sui client publish --gas-budget 200000000
# wire the new package id into the dApp:
echo "VITE_MOBY_PACKAGE_ID=0x<published-package-id>" >> ../../dashboard/.env.local
```

### Deployed (testnet)

| Object | ID |
|---|---|
| moby package | `0x3b634fb9f0f3ed3f6753dbddb743cf40304b0e11eee0b1346161af9f4304a508` |
| DeepBook (active, called) | `0x22be4cade64bf2d02412c7e8d0e8beea2f78828b948118d46735315409371a3c` |
| Pool<DEEP, SUI> | `0x48c95963e9eac37a316b7ae04a0deb761bcdcc2b67912374d6036e7f0e9bae9f` |

## API

| Function | Caller | Effect |
|---|---|---|
| `create_policy(agent, allowed_pool, duration_ms, funds, clock)` | anyone (becomes owner) | escrows `funds` (SUI) as the budget, sets pool + expiry, shares the `AgentPolicy` |
| `top_up_allowance(policy, funds)` | owner | escrows more SUI and raises the ceiling |
| `revoke_policy(policy)` | owner | flips `is_active` to false (kill-switch) |
| `agent_swap<Base>(policy, pool, amount, min_base_out, clock)` | agent | the only fund-exit door: swaps `amount` SUI → `Base` on the allowed pool, asserts all five guards, emits `SpendRecorded` |
| `assert_spend_allowed(policy, pool_id, now_ms, amount, sender)` | — | pure guard helper (unit-testable without a pool) |

Errors: `ENotOwner (0)`, `ENotAgent (1)`, `EPolicyRevoked (2)`,
`EBudgetExceeded (3)`, `EZeroAmount (4)`, `EPolicyExpired (5)`,
`EPoolNotAllowed (6)`, `ESlippage (7)`.
