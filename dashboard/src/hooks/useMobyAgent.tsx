import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { STREAM_INTERVAL_MS, EAT_DURATION_MS } from '../lib/constants';
import { logsForStrategy, swapPhrasesForStrategy } from '../lib/logData';
import type { LogEntry, LogType, WhaleMode } from '../lib/types';
import { usePolicy } from '../providers/PolicyProvider';
import {
  fromBaseUnits,
  TOKEN_SYMBOL,
  type StrategyId,
} from '../lib/moby.config';
import { subscribeSpend, subscribeAgentError } from '../lib/spendEvents';

/** Seed the feed with the opening lines of a strategy's pool. */
function seedFeed(strategy: StrategyId): LogEntry[] {
  return logsForStrategy(strategy)
    .slice(0, 6)
    .map((t, i) => ({ ...t, id: i }));
}

/** The lifecycle phase the agent is in, derived from real policy state. */
export type AgentPhase = 'active' | 'idle' | 'sleeping' | 'revoked';

interface MobyAgentValue {
  // ambient feed state
  logs: LogEntry[];
  tradeCount: number;
  eventCount: number;
  revoked: boolean;
  // on-chain-derived budget (human token units) — the single source of truth
  ceiling: number;
  spent: number;
  budget: number; // remaining headroom under the ceiling
  pct: number; // remaining as a % of the ceiling
  barColor: string;
  // derived state
  phase: AgentPhase;
  whaleMode: WhaleMode;
  // actions
  revoke: () => void;
}

const MobyAgentContext = createContext<MobyAgentValue | null>(null);

/** Count of swap/limit fills inside a seed slice — keeps the stat strip honest. */
function countTrades(entries: LogEntry[]): number {
  return entries.filter((e) => e.type === 'swap' || e.type === 'limit').length;
}

export function MobyAgentProvider({ children }: { children: ReactNode }) {
  const { status, policy, strategy } = usePolicy();

  const [eating, setEating] = useState(false);
  const [revoked, setRevoked] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>(() => seedFeed(strategy));
  const [tradeCount, setTradeCount] = useState(() =>
    countTrades(seedFeed(strategy)),
  );
  const [eventCount, setEventCount] = useState(0);

  // The active strategy drives which feed the ambient stream emits. A ref keeps
  // the long-lived stream interval reading the latest choice without re-mounting.
  const strategyRef = useRef(strategy);
  strategyRef.current = strategy;

  // Re-initialise on strategy switch: clear the old strategy's lines and seed
  // the new one's, so the feed always matches what's selected (one strategy at
  // a time). Skips the initial mount (already seeded above).
  const seededRef = useRef(false);
  useEffect(() => {
    if (!seededRef.current) {
      seededRef.current = true;
      return;
    }
    const fresh = seedFeed(strategy);
    setLogs(fresh);
    setTradeCount(countTrades(fresh));
    setEventCount(0);
  }, [strategy]);

  // ── On-chain truth ──────────────────────────────────────────────────────
  // Every budget figure here is read from the *same* AgentPolicy the execution
  // card and the rest of the dashboard read, so the whole UI stays in sync. A
  // confirmed `record_spend` moves the numbers and makes Moby bite; hitting the
  // ceiling puts it to rest; a top-up wakes it back up.
  const hasPolicy = status === 'active' && !!policy;
  const ceiling =
    policy && status === 'active' ? fromBaseUnits(policy.allowanceLimit) : 0;
  const spent =
    policy && status === 'active' ? fromBaseUnits(policy.amountSpent) : 0;
  const remaining = Math.max(ceiling - spent, 0);
  const onChainExhausted = hasPolicy && remaining <= 0;

  // Ref so the ambient stream interval never tears down on a refetch.
  const liveRef = useRef(false);
  liveRef.current = hasPolicy && remaining > 0 && !revoked;

  // A fresh active policy clears any prior sim-revoked flag (re-delegation).
  useEffect(() => {
    if (hasPolicy) setRevoked(false);
  }, [policy?.policyId, hasPolicy]);

  // Every confirmed `record_spend` (autonomous agent OR manual) is published to
  // the spend bus the instant the tx lands. Subscribe and push a SWAP row with
  // the exact clamped amount + Suiscan digest, and make Moby take a bite. This
  // is the authoritative source of SWAP lines — no indirect re-render guessing.
  // Tracks the last surfaced agent error so a stalled agent doesn't spam the
  // feed; a successful spend clears it so a later failure shows again.
  const lastErrRef = useRef<string | null>(null);

  useEffect(() => {
    return subscribeSpend(({ amountHuman, digest }) => {
      lastErrRef.current = null; // recovery — allow the next error to surface
      const phrases = swapPhrasesForStrategy(strategyRef.current);
      const phrase = phrases[Math.floor(Math.random() * phrases.length)];
      setLogs((p) => [
        {
          id: Date.now() * 1000 + Math.floor(Math.random() * 1000),
          type: 'swap' as LogType,
          msg: `${phrase} · −${amountHuman.toLocaleString()} ${TOKEN_SYMBOL} · record_spend`,
          digest,
        },
        ...p.slice(0, 8),
      ]);
      setTradeCount((n) => n + 1);
      setEating(true);
      setTimeout(() => setEating(false), EAT_DURATION_MS);
    });
  }, []);

  // Surface autonomous-agent failures (e.g. out of gas) into the feed, deduped
  // so a stalled agent doesn't spam an identical row every tick.
  useEffect(() => {
    return subscribeAgentError((message) => {
      if (lastErrRef.current === message) return;
      lastErrRef.current = message;
      setLogs((p) => [
        { id: Date.now(), type: 'policy' as LogType, msg: `⚠ ${message}` },
        ...p.slice(0, 8),
      ]);
    });
  }, []);

  // Log the moment the on-chain ceiling is reached (once, until it recovers).
  const ceilingLoggedRef = useRef(false);
  useEffect(() => {
    if (onChainExhausted && !ceilingLoggedRef.current) {
      ceilingLoggedRef.current = true;
      setLogs((p) => [
        {
          id: Date.now(),
          type: 'policy' as LogType,
          msg: '⚠ On-chain ceiling reached · record_spend exhausted · Moby resting',
        },
        ...p.slice(0, 7),
      ]);
    } else if (!onChainExhausted) {
      ceilingLoggedRef.current = false;
    }
  }, [onChainExhausted]);

  // Ambient Deepbook activity stream — cosmetic liveliness only. It never
  // touches the budget (that is on-chain); it just keeps the feed + whale alive
  // while there is real headroom under the ceiling.
  useEffect(() => {
    const t = setInterval(() => {
      if (!liveRef.current) return;
      const pool = logsForStrategy(strategyRef.current);
      const tpl = pool[Math.floor(Math.random() * pool.length)];
      setLogs((p) => [{ ...tpl, id: Date.now() }, ...p.slice(0, 8)]);
      setEventCount((n) => n + 1);
      if (tpl.type === 'swap' || tpl.type === 'limit') {
        setTradeCount((n) => n + 1);
        setEating(true);
        setTimeout(() => setEating(false), EAT_DURATION_MS);
      }
    }, STREAM_INTERVAL_MS);
    return () => clearInterval(t);
  }, []);

  const revoke = useCallback(() => {
    setRevoked(true);
    setLogs((p) => [
      {
        id: Date.now(),
        type: 'policy' as LogType,
        msg: '⊗ REVOKE confirmed · Agent capability severed on-chain',
      },
      ...p,
    ]);
  }, []);

  const value = useMemo<MobyAgentValue>(() => {
    const whaleMode: WhaleMode =
      revoked || onChainExhausted ? 'sleep' : eating ? 'eat' : 'swim';
    const phase: AgentPhase = revoked
      ? 'revoked'
      : onChainExhausted
        ? 'sleeping'
        : hasPolicy
          ? 'active'
          : 'idle';
    const pct = ceiling > 0 ? Math.round((remaining / ceiling) * 100) : 0;
    const barColor =
      pct > 60 ? 'var(--green)' : pct > 30 ? 'var(--orange)' : 'var(--red)';

    return {
      logs,
      tradeCount,
      eventCount,
      revoked,
      ceiling,
      spent,
      budget: remaining,
      pct,
      barColor,
      phase,
      whaleMode,
      revoke,
    };
  }, [
    revoked,
    eating,
    onChainExhausted,
    hasPolicy,
    ceiling,
    spent,
    remaining,
    logs,
    tradeCount,
    eventCount,
    revoke,
  ]);

  return (
    <MobyAgentContext.Provider value={value}>
      {children}
    </MobyAgentContext.Provider>
  );
}

/** Consume the shared agent state. Must be used within `MobyAgentProvider`. */
export function useMobyAgent(): MobyAgentValue {
  const ctx = useContext(MobyAgentContext);
  if (!ctx) {
    throw new Error('useMobyAgent must be used within a MobyAgentProvider');
  }
  return ctx;
}
