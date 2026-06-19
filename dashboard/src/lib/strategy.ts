// ════════════════════════════════════════════════════════════════════
//  Moby — the agent's "brain" (rule-based, transparent)
//  A spread-gated DCA scorer. Each tick it reads the LIVE DeepBook DEEP/SUI
//  order book, scores the spread 0–100, and decides whether to accumulate —
//  emitting a plain-text reason. No black box: the rule is auditable and the
//  inputs are real on-chain market data, not a simulation.
// ════════════════════════════════════════════════════════════════════

import { BASE_DECIMALS } from './moby.config';

/** DeepBook indexer order book endpoint (testnet — this phase is testnet-only). */
const INDEXER_BASE = 'https://deepbook-indexer.testnet.mystenlabs.com';

/** Spread at/under which the strategy accumulates (basis of the entry rule). */
export const ENTRY_THRESHOLD_PCT = 1.0;

/** Slippage haircut applied when deriving the on-chain `min_base_out` floor. */
const SLIPPAGE_PCT = 10;

interface OrderBook {
  bids: [string, string][]; // [price (SUI/DEEP), size (DEEP)]
  asks: [string, string][];
}

/** The transparent decision for one tick. */
export interface StrategySignal {
  /** 0–100 — higher = tighter spread = better entry. */
  score: number;
  /** Whether the rule says to accumulate this tick. */
  execute: boolean;
  /** Human-readable rationale, e.g. "spread 0.42% ≤ 1.0% → accumulating". */
  reason: string;
  /** Best ask in SUI per DEEP (null if the book is unavailable). */
  bestAsk: number | null;
  /** Observed spread %, or null if unavailable. */
  spreadPct: number | null;
  /** On-chain slippage floor (DEEP base units) for the given SUI input. */
  minBaseOut: bigint;
}

async function fetchOrderBook(): Promise<OrderBook | null> {
  try {
    const r = await fetch(`${INDEXER_BASE}/orderbook/DEEP_SUI?level=2&depth=5`, {
      signal: AbortSignal.timeout(2500),
    });
    if (!r.ok) return null;
    const j = (await r.json()) as OrderBook;
    if (!j.asks?.length || !j.bids?.length) return null;
    return j;
  } catch {
    return null;
  }
}

/**
 * Evaluate one tick against `suiAmountHuman` of intended spend. Reads the live
 * book, scores the spread, and returns the decision + the DEEP `min_base_out`
 * floor (expected fill minus a slippage haircut, rounded down to whole DEEP).
 */
export async function evaluateTick(
  suiAmountHuman: number,
): Promise<StrategySignal> {
  const book = await fetchOrderBook();
  if (!book) {
    return {
      score: 0,
      execute: false,
      reason: 'DeepBook order book unavailable — holding',
      bestAsk: null,
      spreadPct: null,
      minBaseOut: 0n,
    };
  }

  const bestBid = Number(book.bids[0][0]);
  const bestAsk = Number(book.asks[0][0]);
  const mid = (bestBid + bestAsk) / 2;
  const spreadPct = mid > 0 ? ((bestAsk - bestBid) / mid) * 100 : 100;

  // Tight spread → high score: 100 at 0%, 50 at the threshold, 0 at 2×.
  const score = Math.max(
    0,
    Math.min(100, Math.round(100 - (spreadPct / ENTRY_THRESHOLD_PCT) * 50)),
  );
  const execute = spreadPct <= ENTRY_THRESHOLD_PCT;

  // Expected DEEP out = SUI / (SUI-per-DEEP). Floor to whole DEEP after a
  // slippage haircut so the on-chain `min_base_out` won't trip on small moves.
  const expectedDeep = bestAsk > 0 ? suiAmountHuman / bestAsk : 0;
  const flooredDeep = Math.max(
    0,
    Math.floor(expectedDeep * (1 - SLIPPAGE_PCT / 100)),
  );
  const minBaseOut = BigInt(flooredDeep) * BigInt(10 ** BASE_DECIMALS);

  const reason = execute
    ? `spread ${spreadPct.toFixed(2)}% ≤ ${ENTRY_THRESHOLD_PCT.toFixed(
        1,
      )}% → accumulating ${suiAmountHuman} SUI (score ${score})`
    : `spread ${spreadPct.toFixed(2)}% > ${ENTRY_THRESHOLD_PCT.toFixed(
        1,
      )}% → skip, waiting for tighter entry (score ${score})`;

  return { score, execute, reason, bestAsk, spreadPct, minBaseOut };
}
