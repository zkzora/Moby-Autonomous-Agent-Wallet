// ════════════════════════════════════════════════════════════════════
//  Moby — on-chain configuration (testnet)
//  Single source of truth for the deployed package, the DeepBook venue the
//  agent trades, token scaling, the delegated agent, and the strategy.
// ════════════════════════════════════════════════════════════════════

/** Networks Moby will talk to in this phase. Mainnet is intentionally absent. */
export type MobyNetwork = 'testnet' | 'devnet' | 'localnet';

/** Phase 1 runs exclusively on testnet. Do not point this at mainnet. */
export const MOBY_NETWORK: MobyNetwork = 'testnet';

const env = import.meta.env;

/**
 * The published `moby_policy` package id. Env-overridable, but defaults to the
 * live testnet deploy so the hosted dApp works even if the env var is unset.
 * This package's `agent_swap` executes real DeepBook taker swaps gated by the
 * on-chain policy.
 */
export const PACKAGE_ID =
  (env.VITE_MOBY_PACKAGE_ID as string | undefined)?.trim() ||
  '0x3b634fb9f0f3ed3f6753dbddb743cf40304b0e11eee0b1346161af9f4304a508';

/**
 * After a package upgrade the on-chain object TYPE keeps the original package id
 * (above), but function CALLS must target the latest published version. This is
 * that latest id — used for every `moveCall` target. Types/events stay on
 * `PACKAGE_ID`; calls use `PACKAGE_CALL_ID`.
 */
export const PACKAGE_CALL_ID =
  (env.VITE_MOBY_CALL_PACKAGE_ID as string | undefined)?.trim() ||
  '0xc59772890bbe7f58c19f20281804f8e0bf15d300aa9f191eb7449bceb4a2544e';

export const MODULE = 'moby_policy';
export const POLICY_TYPE = `${PACKAGE_ID}::${MODULE}::AgentPolicy`;
export const CREATED_EVENT_TYPE = `${PACKAGE_ID}::${MODULE}::PolicyCreated`;

/** Has a real package id been wired in yet? Gates all on-chain reads/writes. */
export const IS_PACKAGE_DEPLOYED = !/^0x0+$/.test(PACKAGE_ID);

// ── DeepBook venue (testnet) ────────────────────────────────────────────
// The agent escrows SUI (the pool's quote) and buys DEEP (the base) via a real
// taker swap. Verified live on-chain — see packages/move/README.md.

/** Active DeepBook package the swap calls (a v20 deploy; v19 is disabled). */
export const DEEPBOOK_PACKAGE_ID =
  '0x22be4cade64bf2d02412c7e8d0e8beea2f78828b948118d46735315409371a3c';

/** The DEEP token type (base asset of the traded pool). */
export const DEEP_TYPE =
  '0x36dbef866a1d62bf7328989a10fb2f07d769f4ee587c0de4a0a256e57e0a58a8::deep::DEEP';

/** `Pool<DEEP, SUI>` — the only pool the policy delegates trading on. */
export const DEEP_SUI_POOL =
  '0x48c95963e9eac37a316b7ae04a0deb761bcdcc2b67912374d6036e7f0e9bae9f';

/** The shared `Clock` object, required by DeepBook swaps + policy expiry. */
export const CLOCK_ID =
  '0x0000000000000000000000000000000000000000000000000000000000000006';

/**
 * The autonomous agent's address. A deterministic mock by default; override
 * with `VITE_MOBY_AGENT_ADDRESS` to delegate to your real agent keypair.
 */
export const DEFAULT_AGENT_ADDRESS =
  (env.VITE_MOBY_AGENT_ADDRESS as string | undefined)?.trim() ||
  '0xd60e94f57d5a30561e3300e6b342886ed6b01ca2113d0c5e86a9157794215cf8';

/**
 * The autonomous agent's secret key (`suiprivkey…`). TESTNET ONLY — Vite inlines
 * this into the client bundle, so it must hold nothing but gas. When present,
 * the dapp signs `agent_swap` itself (no wallet popups) for any policy that
 * delegates to `DEFAULT_AGENT_ADDRESS`.
 */
export const AGENT_SECRET =
  (env.VITE_MOBY_AGENT_SECRET as string | undefined)?.trim() || '';

/** Is an autonomous agent keypair configured? Gates the auto-execution loop. */
export const HAS_AUTONOMOUS_AGENT = AGENT_SECRET.length > 0;

// ── Token scaling ───────────────────────────────────────────────────────
// The budget/escrow is denominated in SUI (the pool's quote asset, 9 decimals).
// The agent buys DEEP (the base, 6 decimals).

/** SUI carries 9 decimals; the escrow + budget are in SUI. */
export const TOKEN_DECIMALS = 9;
export const TOKEN_SYMBOL = 'SUI';

/** DEEP (what the agent buys) carries 6 decimals. */
export const BASE_DECIMALS = 6;
export const BASE_SYMBOL = 'DEEP';

/**
 * DeepBook `Pool<DEEP,SUI>` min order size: 10 DEEP, lot 1 DEEP. A swap that buys
 * less than this fills nothing, so each agent swap must spend roughly this much
 * SUI worth. ~0.25 SUI comfortably clears it at current prices.
 */
export const MIN_SWAP_SUI = 0.25;

/** Scale a human amount (e.g. 0.25) to the u64 base unit the contract stores. */
export function toBaseUnits(human: number): bigint {
  const scaled = Math.round(human * 10 ** TOKEN_DECIMALS);
  return BigInt(scaled);
}

/** Scale a u64 base-unit value back to a human-readable token amount. */
export function fromBaseUnits(base: bigint | number | string): number {
  return Number(BigInt(base)) / 10 ** TOKEN_DECIMALS;
}

/** Scale a DEEP base-unit value (6 decimals) to human DEEP. */
export function fromBaseDeep(base: bigint | number | string): number {
  return Number(BigInt(base)) / 10 ** BASE_DECIMALS;
}

/** Suiscan transaction URL for the active network. */
export function txExplorerUrl(digest: string): string {
  return `https://suiscan.xyz/${MOBY_NETWORK}/tx/${digest}`;
}

/** Shorten an address for display: 0x7a4f…3f2c */
export function shortAddress(addr: string, lead = 6, tail = 4): string {
  if (!addr.startsWith('0x') || addr.length <= lead + tail + 2) return addr;
  return `${addr.slice(0, lead)}…${addr.slice(-tail)}`;
}

// ── Execution strategy (the agent's "brain") ────────────────────────────
// One reactive strategy, by design: a spread-gated DCA that reads the live
// DeepBook book each tick and only buys when the spread is tight enough.

export interface Strategy {
  id: string;
  label: string;
  pair: string;
  blurb: string;
}

export const STRATEGIES: readonly Strategy[] = [
  {
    id: 'reactive-dca',
    label: 'Reactive DCA',
    pair: 'DEEP/SUI',
    blurb:
      'Reads the live DeepBook spread each tick; accumulates DEEP only when the spread is tight enough, skipping when it widens.',
  },
] as const;

export type StrategyId = (typeof STRATEGIES)[number]['id'];
export const DEFAULT_STRATEGY: StrategyId = 'reactive-dca';
