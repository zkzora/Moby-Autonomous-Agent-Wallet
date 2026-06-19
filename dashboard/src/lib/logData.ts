import type { LogTemplate, LogType, PillColor } from './types';
import { DEFAULT_STRATEGY, type StrategyId } from './moby.config';

/* ── Strategy-specific activity feeds ─────────────────────────────────────
   Each strategy narrates its own logic. The ambient stream reads the ACTIVE
   strategy's pool, so the feed always matches what's selected.

   IMPORTANT: these lines carry NO USDC budget-spend amounts. Only the real,
   on-chain `record_spend` debit (clamped to the remaining ceiling) ever prints
   a spend figure — see STRATEGY_SWAP_PHRASES below. That keeps every amount in
   the feed exactly equal to what actually hit the chain (never "6 USDC" when
   only 2 remain). Prices/percentages/P&L here are scenery, not budget debits. */
/* Ambient "scenery" — scans, limit-order placement, policy checks. NO swaps and
   NO USDC amounts live here: a SWAP line means a real on-chain spend, and that
   line is built dynamically with the exact clamped `record_spend` amount (see
   STRATEGY_SWAP_PHRASES). */
export const STRATEGY_LOGS: Record<StrategyId, LogTemplate[]> = {
  'reactive-dca': [
    { type: 'scan',   msg: 'Reading DeepBook DEEP/SUI order book' },
    { type: 'scan',   msg: 'Scoring spread against entry threshold' },
    { type: 'policy', msg: 'Policy check passed · spend within Move ceiling' },
    { type: 'scan',   msg: 'Spread too wide — holding this tick' },
    { type: 'scan',   msg: 'Tracking best bid/ask for the next entry' },
    { type: 'scan',   msg: 'Flattening accumulation across volatility' },
  ],
};

/** The active strategy's ambient feed (falls back to the default). */
export function logsForStrategy(id: StrategyId): LogTemplate[] {
  return STRATEGY_LOGS[id] ?? STRATEGY_LOGS[DEFAULT_STRATEGY];
}

/** Strategy-flavoured phrases for a real SWAP line. The caller appends the
 *  exact clamped `record_spend` amount, so every SWAP shows a true figure. */
export const STRATEGY_SWAP_PHRASES: Record<StrategyId, string[]> = {
  'reactive-dca': ['DCA tranche filled', 'DEEP accumulated', 'Spread-gated entry buy'],
};

export function swapPhrasesForStrategy(id: StrategyId): string[] {
  return STRATEGY_SWAP_PHRASES[id] ?? STRATEGY_SWAP_PHRASES[DEFAULT_STRATEGY];
}

/** Per-type badge styling. */
export const LOG_STYLE: Record<
  LogType,
  { bg: string; color: string; label: string }
> = {
  swap:   { bg: 'rgba(200,255,0,0.12)',  color: 'var(--lime)',   label: 'SWAP' },
  scan:   { bg: 'rgba(138,155,176,0.1)', color: 'var(--ink-2)',  label: 'SCAN' },
  limit:  { bg: 'rgba(255,107,53,0.12)', color: 'var(--orange)', label: 'LIMIT' },
  policy: { bg: 'rgba(139,92,246,0.12)', color: 'var(--purple)', label: 'POLICY' },
};

/** Rotating agent state-text line shown beneath the whale tank. */
export const AGENT_MSGS: string[] = [
  'Scanning Deepbook order books…',
  'Evaluating spread: 0.11% · SUI/USDC',
  'Executing micro-strategy #51…',
  'Waiting for optimal entry point…',
  'Policy ceiling check: OK',
  'Placing limit order on CLOB…',
];

/** Map a log type to its pill colour (used for the live badge counter). */
export const LOG_TYPE_PILL: Record<LogType, PillColor> = {
  swap: 'lime',
  scan: 'outline',
  limit: 'orange',
  policy: 'purple',
};
