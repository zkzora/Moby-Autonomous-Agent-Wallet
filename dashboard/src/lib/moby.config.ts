// ════════════════════════════════════════════════════════════════════
//  Moby — on-chain configuration (Phase 1: testnet only)
//  Single source of truth for the deployed package, token scaling, the
//  delegated agent, and the selectable execution strategies.
// ════════════════════════════════════════════════════════════════════

/** Networks Moby will talk to in this phase. Mainnet is intentionally absent. */
export type MobyNetwork = 'testnet' | 'devnet' | 'localnet';

/** Phase 1 runs exclusively on testnet. Do not point this at mainnet. */
export const MOBY_NETWORK: MobyNetwork = 'testnet';

const ZERO_ADDRESS =
  '0x0000000000000000000000000000000000000000000000000000000000000000';

const env = import.meta.env;

/**
 * The published `moby_policy` package id, injected at build time once the Move
 * package is deployed (`VITE_MOBY_PACKAGE_ID`). Until then it stays the zero
 * address and the UI surfaces a "deploy the package" notice rather than firing
 * transactions that would abort.
 */
export const PACKAGE_ID =
  (env.VITE_MOBY_PACKAGE_ID as string | undefined)?.trim() || ZERO_ADDRESS;

export const MODULE = 'moby_policy';
export const POLICY_TYPE = `${PACKAGE_ID}::${MODULE}::AgentPolicy`;
export const CREATED_EVENT_TYPE = `${PACKAGE_ID}::${MODULE}::PolicyCreated`;

/** Has a real package id been wired in yet? Gates all on-chain reads/writes. */
export const IS_PACKAGE_DEPLOYED = !/^0x0+$/.test(PACKAGE_ID);

/**
 * The autonomous agent's address. A deterministic mock by default so the demo
 * works out of the box; override with `VITE_MOBY_AGENT_ADDRESS` to delegate to
 * your real agent keypair.
 */
export const DEFAULT_AGENT_ADDRESS =
  (env.VITE_MOBY_AGENT_ADDRESS as string | undefined)?.trim() ||
  '0xd60e94f57d5a30561e3300e6b342886ed6b01ca2113d0c5e86a9157794215cf8';

/**
 * The autonomous agent's secret key (`suiprivkey…`). TESTNET ONLY — Vite inlines
 * this into the client bundle, so it must hold nothing but gas. When present,
 * the dapp signs `record_spend` itself (no wallet popups) for any policy that
 * delegates to `DEFAULT_AGENT_ADDRESS`.
 */
export const AGENT_SECRET =
  (env.VITE_MOBY_AGENT_SECRET as string | undefined)?.trim() || '';

/** Is an autonomous agent keypair configured? Gates the auto-execution loop. */
export const HAS_AUTONOMOUS_AGENT = AGENT_SECRET.length > 0;

/** USDC on Sui testnet carries 6 decimals; the form takes human units. */
export const TOKEN_DECIMALS = 6;
export const TOKEN_SYMBOL = 'USDC';

/** Scale a human amount (e.g. 500) to the u64 base unit the contract stores. */
export function toBaseUnits(human: number): bigint {
  // Round to the token's precision before scaling to avoid float dust.
  const scaled = Math.round(human * 10 ** TOKEN_DECIMALS);
  return BigInt(scaled);
}

/** Scale a u64 base-unit value back to a human-readable token amount. */
export function fromBaseUnits(base: bigint | number | string): number {
  return Number(BigInt(base)) / 10 ** TOKEN_DECIMALS;
}

/** Suiscan transaction URL for the active network — lets judges verify a
 * `record_spend` digest on-chain with one click. */
export function txExplorerUrl(digest: string): string {
  return `https://suiscan.xyz/${MOBY_NETWORK}/tx/${digest}`;
}

/** Shorten an address for display: 0x7a4f…3f2c */
export function shortAddress(addr: string, lead = 6, tail = 4): string {
  if (!addr.startsWith('0x') || addr.length <= lead + tail + 2) return addr;
  return `${addr.slice(0, lead)}…${addr.slice(-tail)}`;
}

// ── Execution strategies (the AI "brain" the agent runs) ────────────────

export interface Strategy {
  id: string;
  label: string;
  pair: string;
  blurb: string;
}

export const STRATEGIES: readonly Strategy[] = [
  {
    id: 'micro-arb',
    label: 'Micro-Arbitrage',
    pair: 'SUI/USDC',
    blurb: 'Captures sub-second price gaps across Deepbook order books.',
  },
  {
    id: 'liquidity-snipe',
    label: 'Deepbook Liquidity Sniping',
    pair: 'CLOB',
    blurb: 'Fills resting size the instant spreads widen past threshold.',
  },
  {
    id: 'dca-smooth',
    label: 'Smart DCA Smoothing',
    pair: 'SUI/USDC',
    blurb: 'Spreads accumulation across volatility to flatten entry price.',
  },
] as const;

export type StrategyId = (typeof STRATEGIES)[number]['id'];
export const DEFAULT_STRATEGY: StrategyId = 'micro-arb';
