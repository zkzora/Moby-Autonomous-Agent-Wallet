# Moby — App Command Center

The dedicated dashboard for **Moby**, a non-custodial autonomous agent wallet on
Sui (Sui Overflow 2025). It renders the live agent — Moby — executing
micro-strategies on Deepbook's CLOB inside a Move Policy ceiling, with an
on-chain kill-switch.

Built by extracting the `CommandCenter` / `MobyPanel` / `ActivityLog` logic from
`landing-v2.html` into a modular React + TypeScript architecture, preserving the
exact visual identity and behaviour.

## Run

```bash
npm install
npm run dev        # http://localhost:5173
```

```bash
npm run build      # type-check + production bundle → dist/
npm run preview    # serve the build
```

## What's inside

| Area | Files |
| --- | --- |
| Design tokens + keyframes | `src/styles/{tokens,animations,app}.css` |
| State engine (one source of truth) | `src/hooks/useMobyAgent.tsx` |
| Rotating agent text | `src/hooks/useRotatingIndex.ts` |
| Data / config | `src/lib/{logData,whaleSheets,constants,types}.ts` |
| Sprite-sheet whale | `src/components/AnimatedWhale.tsx` |
| Agent controller | `src/components/MobyPanel.tsx` |
| Live trade stream | `src/components/ActivityLog.tsx` + `LogRow`, `BudgetMeter` |
| Dashboard window | `src/components/CommandCenter.tsx` + `ChromeBar` |
| Shell | `src/components/{TopBar,Footer,StatStrip}.tsx`, `src/App.tsx` |

## Architecture

| Layer | Description |
| --- | --- |
| Move contract | `moby_policy` package — `AgentPolicy` shared object with vault, ceiling, expiry, pool scope |
| Agent engine | Rule-based Reactive DCA scorer reads DeepBook order book live, executes `agent_swap` |
| Dashboard | React + TypeScript — renders live on-chain state, owner controls |

## On-chain mechanics

- **`agent_swap`** is the single fund egress: 5 Move asserts (agent-only,
  active, not-expired, pool-locked, under-ceiling) → split vault → real
  DeepBook taker swap → emit `SpendRecorded`.
- **`revoke_policy`** sets `is_active = false` permanently. Any subsequent
  `agent_swap` aborts with `EPolicyRevoked`.
- **`withdraw_unspent`** / **`close_policy`** let the owner reclaim escrowed
  SUI at any time — non-custodial by design.
- Strategy: **Reactive DCA** — scores bid-ask spread 0–100, executes when
  score ≥ 40, derives `min_base_out` from live best-ask (5% slippage floor).

## Verified on-chain

- Swap: `F86Hpob3s8yzRdroTKrUL6eS1WMk94AnUyF4ghP17WMv`
  — DEEP +10, OrderFilled (DeepBook), SpendRecorded (Moby)
- Package: `0x3b634fb9f0f3ed3f6753dbddb743cf40304b0e11eee0b1346161af9f4304a508`
- Network: Sui Testnet

Brand identity is documented in [`brand.md`](./brand.md).
