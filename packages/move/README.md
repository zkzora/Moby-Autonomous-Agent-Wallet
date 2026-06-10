# moby_policy — Move package

The on-chain guardrail for Moby's autonomous agent wallet: a shared
`AgentPolicy` object that enforces a hard spend ceiling (the "Capped Budget
Ceiling") and an owner-only kill-switch (the "Kill-Switch").

## Layout

```
packages/move/
├── Move.toml
└── sources/
    └── moby_policy.move
```

## Build & test

```bash
cd packages/move
sui move build
sui move test
```

The test suite covers spend-within-budget, budget-exceeded abort, spend-after-
revoke abort, owner/agent authority separation, and top-up.

## Publish to testnet

```bash
# 1. Make sure the active env is testnet and the address has gas:
sui client switch --env testnet
sui client faucet

# 2. Publish:
sui client publish --gas-budget 100000000

# 3. Copy the created package id from the output, then wire it into the dApp:
echo "VITE_MOBY_PACKAGE_ID=0x<published-package-id>" >> ../../dashboard/.env.local
```

Once `VITE_MOBY_PACKAGE_ID` is set, the dashboard reads/writes the real
`AgentPolicy` object: the Deploy Policy form, Top Up, and Revoke all become
live testnet transactions signed by the connected wallet.

## API

| Function | Caller | Effect |
|---|---|---|
| `create_policy(agent, allowance_limit)` | anyone (becomes owner) | creates + shares an `AgentPolicy` |
| `top_up_allowance(policy, amount)` | owner | raises the ceiling |
| `revoke_policy(policy)` | owner | flips `is_active` to false (kill-switch) |
| `record_spend(policy, amount)` | agent | records spend, asserts active + under ceiling |

Errors: `ENotOwner (0)`, `ENotAgent (1)`, `EPolicyRevoked (2)`,
`EBudgetExceeded (3)`, `EZeroAmount (4)`.
