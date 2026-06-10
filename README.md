# 🐋 Moby — Autonomous Agent Wallet

> **An on-chain autonomous agent wallet built on Sui.** Moby lets you delegate a capped spending budget to an AI agent, enforced by a Move smart contract kill-switch — so the agent can act, but only within the limits you set.

[![Sui Testnet](https://img.shields.io/badge/Sui-Testnet-6fbcf0?logo=sui&logoColor=white)](https://suiexplorer.com)
[![Move](https://img.shields.io/badge/Move-2024.beta-4a90d9)](https://docs.sui.io/guides/developer/first-app)
[![React](https://img.shields.io/badge/React-18-61dafb?logo=react)](https://react.dev)
[![Vite](https://img.shields.io/badge/Vite-5-646cff?logo=vite)](https://vitejs.dev)

---

## ✨ How It Works

1. **Deploy a Policy** — Connect your wallet, set an agent address and a SUI budget ceiling, and call `create_policy`. A shared `AgentPolicy` object is created on-chain.
2. **Agent Acts** — The delegated agent calls `record_spend` for every action it takes. The contract asserts the spend stays within the ceiling.
3. **Kill-Switch** — At any time the owner can call `revoke_policy` to immediately stop all further agent spending.
4. **Top Up** — The owner can raise the ceiling at any time via `top_up_allowance`.

---

## 📁 Repository Structure

```
Moby/
├── packages/
│   └── move/                   # On-chain Move smart contract
│       ├── Move.toml
│       ├── Move.lock
│       ├── Published.toml      # Deployed contract metadata
│       └── sources/
│           └── moby_policy.move
├── dashboard/                  # React + Vite front-end dApp
│   ├── src/
│   │   ├── components/         # UI components (17 total)
│   │   ├── pages/              # Landing, Dashboard, Docs
│   │   ├── hooks/              # useAutonomousAgent, useMobyAgent, usePolicyState
│   │   ├── providers/          # SuiProviders, PolicyProvider
│   │   ├── lib/                # Config, types, constants, router
│   │   └── styles/             # CSS tokens, animations, app styles
│   ├── index.html
│   ├── package.json
│   ├── vite.config.ts
│   └── .env.example
├── moby_eating.png             # Brand assets
├── moby_sleep.png
└── moby_swimming.png
```

---

## 🚀 Quick Start

### 1. Clone & Install

```bash
git clone https://github.com/zkzora/Moby-Autonomous-Agent-Wallet.git
cd Moby-Autonomous-Agent-Wallet
cd dashboard
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env.local
# Edit .env.local and set VITE_MOBY_PACKAGE_ID to the deployed package address
```

### 3. Run the Dashboard

```bash
npm run dev
# Open http://localhost:5173
```

---

## 📦 Move Smart Contract

The `moby_policy` Move package is deployed on **Sui Testnet**.

| Property | Value |
|---|---|
| Network | Sui Testnet |
| Package ID | `0x11c76b435d2b96e22ce7f589c1ffaca48d88ab745102e73d37e784a9655412b8` |
| Chain ID | `4c78adac` |

### Build & Test Locally

```bash
cd packages/move
sui move build
sui move test
```

### Contract API

| Function | Caller | Effect |
|---|---|---|
| `create_policy(agent, allowance_limit)` | anyone (becomes owner) | Creates + shares an `AgentPolicy` |
| `top_up_allowance(policy, amount)` | owner | Raises the spending ceiling |
| `revoke_policy(policy)` | owner | Flips `is_active` to false (kill-switch) |
| `record_spend(policy, amount)` | agent | Records spend, asserts active + under ceiling |

**Errors:** `ENotOwner (0)`, `ENotAgent (1)`, `EPolicyRevoked (2)`, `EBudgetExceeded (3)`, `EZeroAmount (4)`

---

## 🛠 Tech Stack

| Layer | Technology |
|---|---|
| Blockchain | [Sui Network](https://sui.io) |
| Smart Contract | [Move 2024](https://docs.sui.io) |
| Frontend | [React 18](https://react.dev) + [TypeScript](https://www.typescriptlang.org) |
| Build Tool | [Vite 5](https://vitejs.dev) |
| Wallet Integration | [@mysten/dapp-kit](https://sdk.mystenlabs.com/dapp-kit) |
| State / Queries | [@tanstack/react-query](https://tanstack.com/query) |

---

## 🔐 Security Model

- The agent **never holds custody** of funds — it can only call `record_spend` to log actions
- The owner's kill-switch is enforced **on-chain** — no off-chain logic can bypass it
- Budget ceiling is immutable once set, unless the owner explicitly calls `top_up_allowance`
- Private keys and `.env.local` are **never committed** to this repository

---

## 📄 License

MIT — see [LICENSE](LICENSE) for details.

---

<p align="center">Built with 🐋 by <a href="https://github.com/zkzora">zkzora</a></p>
