# Brand — Moby

_Status: locked (extracted from `landing-v2.html`, the canonical visual identity)_

Moby is a non-custodial autonomous agent wallet on Sui. The aesthetic is
**premium-minimal dark / workstation-dense**: thin wire borders, obsidian
canvas, mono-typed technical data, one accent colour per context. Decoration is
borders and pills, never gradients or glass.

## Palette (CSS variables — `src/styles/tokens.css`)

| Token         | Value                       | Role                              |
| ------------- | --------------------------- | --------------------------------- |
| `--bg`        | `#0C0E14`                   | Deep obsidian primary background  |
| `--surface`   | `rgba(255,255,255,0.025)`   | Card / panel surface              |
| `--border`    | `rgba(255,255,255,0.08)`    | Ultra-thin border (1px)           |
| `--border-hi` | `rgba(255,255,255,0.14)`    | Hover / emphasis border           |
| `--ink`       | `#F0F4F8`                   | Primary text                      |
| `--ink-2`     | `#8A9BB0`                   | Secondary text                    |
| `--ink-3`     | `#4A5568`                   | Tertiary / mono labels            |
| `--lime`      | `#C8FF00`                   | Pill · swap badge                 |
| `--orange`    | `#FF6B35`                   | Pill · limit badge · paused       |
| `--blue`      | `#4DA2FF`                   | Pill · active accent · scan       |
| `--purple`    | `#8B5CF6`                   | Pill · policy badge               |
| `--red`       | `#F05252`                   | Pill · revoke / kill-switch       |
| `--green`     | `#10B981`                   | Healthy budget                    |

Pills carry dark ink on bright fills (lime/orange/blue/green) and white on
purple/red. `pill-outline` is a mono, low-key bordered chip.

## Typography

- **Space Grotesk** (`--font-display`) — headings, structural layout, buttons.
- **JetBrains Mono** (`--font-mono`) — all technical data, logs, metrics, pills,
  addresses, status lines.
- Never put a display font on data/labels; never put mono on prose headings.

## Motion

- Single easing voice: `cubic-bezier(0.16, 1, 0.3, 1)` (`--ease-out`). No bounce.
- Motion conveys agent state only: `scan`, `row-in`, `moby-sprite`, `pulse`,
  `z-float`. No orchestrated page-load theater on this task surface.
- Every animation has a `prefers-reduced-motion` fallback (global safety net).

## Rules

- No pure `#000`. No gradient text. No glassmorphism as default. No nested cards.
- Card radius 10–14px; pills are full-round. Borders are 1px.
- Contrast ≥ AA; mono labels on dark stay at `--ink-2`/`--ink-3` against obsidian.
