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

## Core behaviours

- **Live stream** emits a Deepbook event every 2.4s; `swap` rows deduct a random
  5–16 USDC from the 500-USDC ceiling; the top row flashes `.fresh`.
- **Budget depletion** transitions the meter green → orange → red. At exactly 0
  it pushes a policy-ceiling-hit log and the agent suspends.
- **Revoke** (kill-switch) destroys the capability object, freezes the agent,
  and drops a crimson `ACCESS REVOKED` overlay over the tank.
- **Sleep** (budget dry or revoked) forces the whale grayscale with floating
  pixelated `Z`s.
- **Pause/resume** from the top bar halts execution without revoking.

Brand identity is documented in [`brand.md`](./brand.md).
