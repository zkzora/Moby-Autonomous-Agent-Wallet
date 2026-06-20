import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import { Link, useNavigate } from '../lib/router';
import { Pill } from '../components/Pill';
import { AnimatedWhale } from '../components/AnimatedWhale';
import type { WhaleMode } from '../lib/types';

/* ════════════════════════════════════════════════════════════════════
   Landing — the public marketing page. A self-contained animated demo
   (separate from the live on-chain dashboard) that shows the agent loop.
   Ported from the original standalone landing-v2.html.
   ════════════════════════════════════════════════════════════════════ */

type LogKind = 'swap' | 'scan' | 'limit' | 'policy';
interface DemoLog {
  id: number;
  type: LogKind;
  msg: string;
}

const LOG_POOL: { type: LogKind; msg: string }[] = [
  { type: 'scan', msg: 'Reading DEEP/SUI order book — spread: 0.82%, score: 59' },
  { type: 'swap', msg: 'Reactive DCA: 0.25 SUI → 10 DEEP via DeepBook CLOB' },
  { type: 'scan', msg: 'Spread widening — 4.1%, score: 18 · holding position' },
  { type: 'policy', msg: 'Policy check: 0.25/1.00 SUI spent · ceiling intact' },
  { type: 'swap', msg: 'Conditions met — executing agent_swap · min_out: 9 DEEP' },
  { type: 'scan', msg: 'No ask-side liquidity on DEEP/SUI — waiting for depth' },
  { type: 'policy', msg: 'SpendRecorded on-chain · amount_spent updated' },
  { type: 'swap', msg: 'Reactive DCA: 0.25 SUI → 11 DEEP · slippage 0.3%' },
  { type: 'scan', msg: 'Evaluating spread: 1.2% · score: 76 — monitoring' },
  { type: 'policy', msg: 'Budget 0.75/1.00 SUI used · Move Policy ceiling OK' },
];

const LOG_STYLE: Record<LogKind, { bg: string; color: string; label: string }> = {
  swap: { bg: 'rgba(200,255,0,0.12)', color: 'var(--lime)', label: 'SWAP' },
  scan: { bg: 'rgba(138,155,176,0.1)', color: 'var(--ink-2)', label: 'SCAN' },
  limit: { bg: 'rgba(255,107,53,0.12)', color: 'var(--orange)', label: 'LIMIT' },
  policy: { bg: 'rgba(139,92,246,0.12)', color: 'var(--purple)', label: 'POLICY' },
};

const AGENT_MSGS = [
  'Reading DEEP/SUI order book…',
  'Spread: 0.82% · score 59 — evaluating…',
  'Conditions met — executing Reactive DCA…',
  'Waiting for ask-side liquidity…',
  'Policy ceiling check: OK',
  'agent_swap submitted to DeepBook…',
];

/* ── Nav ──────────────────────────────────────────────────────────── */
function Nav() {
  const navigate = useNavigate();
  return (
    <nav className="lp-nav" aria-label="Main navigation">
      <div
        className="lp-nav-inner"
        style={{ justifyContent: 'space-between' }}
      >
        <Link className="brand-mark" to="/" aria-label="Moby home">
          <img className="brand-logo" src="/moby-logo.png" alt="" aria-hidden="true" />
          Moby
        </Link>
        <div
          style={{
            display: 'flex',
            gap: 12,
            alignItems: 'center',
          }}
        >
          <Link className="btn btn-ghost" to="/docs">
            Docs
          </Link>
          <button
            className="btn btn-solid"
            onClick={() => navigate('/dashboard')}
          >
            Launch App
          </button>
        </div>
      </div>
    </nav>
  );
}

/* ── Hero ─────────────────────────────────────────────────────────── */
function Hero() {
  const navigate = useNavigate();
  const stats: [string, string][] = [
    ['Move Policy Objects', 'Hard on-chain budget ceilings'],
    ['Deepbook CLOB', 'Native order-book execution'],
    ['zkLogin Compatible', 'Social login, no seed phrase'],
    ['Non-custodial', 'Keys stay with the owner'],
  ];
  return (
    <section className="lp-hero">
      <h1 className="lp-hero-headline">
        Your wallet, <Pill c="lime">finally autonomous</Pill> —<br />
        executes on <Pill c="blue">Deepbook</Pill> within{' '}
        <Pill c="orange">hard limits</Pill>
        <br />
        <Pill c="purple">you define.</Pill>
      </h1>

      <p className="lp-hero-body">
        Moby is a non-custodial agent wallet on Sui. It runs a rule-based
        Reactive DCA strategy on Deepbook's order book, bounded by Move Policy
        Objects you set, revocable in a single on-chain transaction.
      </p>

      <div
        style={{
          display: 'flex',
          gap: 12,
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <button className="btn btn-solid" onClick={() => navigate('/dashboard')}>
          Launch App
        </button>
        <Link className="btn btn-ghost" to="/docs">
          Read Docs →
        </Link>
      </div>

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 24,
          marginTop: 56,
          paddingTop: 32,
          borderTop: '1px solid var(--border)',
          justifyContent: 'center',
        }}
      >
        {stats.map(([label, detail]) => (
          <div key={label} style={{ minWidth: 140 }}>
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                color: 'var(--blue)',
                letterSpacing: '0.04em',
                marginBottom: 4,
              }}
            >
              {label}
            </div>
            <div style={{ fontSize: 13, color: 'var(--ink-3)', lineHeight: 1.4 }}>
              {detail}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ── Left panel (whale + revoke) ──────────────────────────────────── */
function MobyPanel({
  revoked,
  onRevoke,
  whaleMode,
}: {
  revoked: boolean;
  onRevoke: () => void;
  whaleMode: WhaleMode;
}) {
  const [stateIdx, setStateIdx] = useState(0);
  const sleeping = whaleMode === 'sleep';

  useEffect(() => {
    if (revoked || sleeping) return;
    const t = setInterval(
      () => setStateIdx((i) => (i + 1) % AGENT_MSGS.length),
      2600,
    );
    return () => clearInterval(t);
  }, [revoked, sleeping]);

  const statusColor = revoked
    ? 'var(--red)'
    : sleeping
      ? 'var(--ink-3)'
      : 'var(--blue)';
  const statusMsg = revoked
    ? '⊗ Agent connection severed on-chain'
    : sleeping
      ? '… Budget ceiling reached · Agent resting'
      : `● ${AGENT_MSGS[stateIdx]}`;

  return (
    <>
      <div className="whale-box" style={{ flex: 1 }}>
        <div className="whale-dot-grid" />
        {!revoked && !sleeping && <div className="scan-bar" />}
        <div style={{ position: 'relative', zIndex: 1 }}>
          <AnimatedWhale px={8} mode={whaleMode} />
        </div>
        {revoked && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              zIndex: 2,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(240,82,82,0.04)',
            }}
          >
            <Pill c="red" style={{ fontSize: 10, letterSpacing: '0.07em' }}>
              ACCESS REVOKED
            </Pill>
          </div>
        )}
      </div>

      <p
        key={stateIdx}
        className="agent-state"
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          color: statusColor,
          textAlign: 'center',
          lineHeight: 1.5,
          minHeight: 16,
        }}
      >
        {statusMsg}
      </p>

      <button
        className="btn-revoke"
        disabled={revoked}
        onClick={!revoked ? onRevoke : undefined}
        aria-label="Revoke agent access permanently on-chain"
      >
        {revoked ? '⊗ Agent Disconnected' : '⊗  Revoke Agent Access'}
      </button>
    </>
  );
}

/* ── Right panel (activity log + budget) ──────────────────────────── */
function ActivityLog({ logs, budget }: { logs: DemoLog[]; budget: number }) {
  const pct = Math.round((budget / 1.0) * 100);
  const barColor =
    pct > 60 ? 'var(--green)' : pct > 30 ? 'var(--orange)' : 'var(--red)';

  return (
    <>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 14,
        }}
      >
        <span className="mono" style={{ color: 'var(--ink-3)' }}>
          ON-CHAIN ACTIVITY LOG
        </span>
        <span className="mono">Live · Deepbook CLOB</span>
      </div>

      <div style={{ marginBottom: 20 }}>
        <div
          style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}
        >
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 12,
              color: 'var(--ink-2)',
            }}
          >
            Move Policy ceiling
          </span>
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 12,
              fontWeight: 600,
              color: 'var(--ink)',
            }}
          >
            {budget.toFixed(2)} / 1.00 SUI
          </span>
        </div>
        <div className="budget-bar-track">
          <div
            className="budget-bar-fill"
            style={{ width: `${pct}%`, backgroundColor: barColor }}
          />
        </div>
        <div
          style={{ display: 'flex', justifyContent: 'space-between', marginTop: 5 }}
        >
          <span className="mono">Allowance used</span>
          <span className="mono" style={{ color: barColor }}>
            {pct}%
          </span>
        </div>
      </div>

      <div className="log-list">
        {logs.map((entry, i) => {
          const s = LOG_STYLE[entry.type] ?? LOG_STYLE.scan;
          return (
            <div key={entry.id} className={`log-row ${i === 0 ? 'fresh' : ''}`}>
              <span
                className="log-badge"
                style={{ background: s.bg, color: s.color, borderColor: `${s.color}25` }}
              >
                {s.label}
              </span>
              <span className="log-text">{entry.msg}</span>
            </div>
          );
        })}
      </div>
    </>
  );
}

/* ── Animated demo command center ─────────────────────────────────── */
function CommandCenterDemo() {
  const [revoked, setRevoked] = useState(false);
  const [budget, setBudget] = useState(0.75);
  const [eating, setEating] = useState(false);
  const [logs, setLogs] = useState<DemoLog[]>(() =>
    LOG_POOL.slice(0, 6).map((t, i) => ({ ...t, id: i })),
  );

  const budgetRef = useRef(0.75);
  useEffect(() => {
    const prev = budgetRef.current;
    budgetRef.current = budget;
    if (prev > 0 && budget === 0) {
      setLogs((p) => [
        {
          id: Date.now(),
          type: 'policy',
          msg: '⚠ Move Policy ceiling hit · 1.00/1.00 SUI consumed · Agent suspended',
        },
        ...p.slice(0, 7),
      ]);
    }
  }, [budget]);

  useEffect(() => {
    if (revoked) return;
    const t = setInterval(() => {
      if (budgetRef.current <= 0) return;
      const tpl = LOG_POOL[Math.floor(Math.random() * LOG_POOL.length)];
      setLogs((p) => [{ ...tpl, id: Date.now() }, ...p.slice(0, 8)]);
      if (tpl.type === 'swap') {
        setBudget((p) => Math.max(+(p - (Math.random() * 0.05 + 0.2)).toFixed(3), 0));
      }
      if (tpl.type === 'swap' || tpl.type === 'limit') {
        setEating(true);
        setTimeout(() => setEating(false), 680);
      }
    }, 2400);
    return () => clearInterval(t);
  }, [revoked]);

  const whaleMode: WhaleMode =
    revoked || budget <= 0 ? 'sleep' : eating ? 'eat' : 'swim';

  const handleRevoke = () => {
    setRevoked(true);
    setLogs((p) => [
      {
        id: Date.now(),
        type: 'policy',
        msg: '⊗ REVOKE confirmed · policy is_active set to false · EPolicyRevoked enforced in Move',
      },
      ...p,
    ]);
  };

  return (
    <section className="lp-dashboard-wrap">
      <div style={{ marginBottom: 32 }}>
        <h2 className="section-h">
          Moby, at work <Pill c="outline">Simulated preview</Pill>
        </h2>
        <p className="section-sub">
          Watch the agent execute its Reactive DCA strategy inside your ceiling,
          in real time. Tap the kill-switch to see instant on-chain revocation.
        </p>
      </div>

      <div className="dashboard-card">
        <div className="dash-chrome">
          <div className="chrome-dot" style={{ background: 'rgba(240,82,82,0.5)' }} />
          <div className="chrome-dot" style={{ background: 'rgba(245,158,11,0.5)' }} />
          <div className="chrome-dot" style={{ background: 'rgba(16,185,129,0.5)' }} />
          <span className="mono" style={{ marginLeft: 'auto' }}>
            moby.agent.sui · deepbook/testnet
          </span>
        </div>

        <div className="dash-grid">
          <div className="dash-left">
            <MobyPanel revoked={revoked} onRevoke={handleRevoke} whaleMode={whaleMode} />
          </div>
          <div className="dash-right">
            <ActivityLog logs={logs} budget={budget} />
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── Features bento ───────────────────────────────────────────────── */
interface Feat {
  wide?: boolean;
  tag: string;
  tagC: 'lime' | 'blue' | 'orange' | 'purple';
  title: string;
  body: string;
  meta: string;
}
const FEATS: Feat[] = [
  {
    wide: true,
    tag: 'Move Objects',
    tagC: 'lime',
    title: 'Capped Budgeting',
    body: 'A hard SUI ceiling encoded directly into a Move Policy Object on-chain. The agent is mathematically incapable of spending beyond it — no trust model, no exceptions.',
    meta: 'Policy ceiling · Zero-trust enforcement',
  },
  {
    tag: 'Deepbook',
    tagC: 'blue',
    title: 'Autonomous Execution',
    body: "Moby scores the live Deepbook spread each tick and executes real swaps on its Central Limit Order Book — only when the entry is favourable. Entirely on-chain.",
    meta: 'CLOB native · No custody',
  },
  {
    tag: 'Owner override',
    tagC: 'orange',
    title: 'Absolute Control',
    body: "One transaction destroys the agent's capability object permanently. No cooldown. Cryptographic, enforced by Move.",
    meta: 'Instant · Irreversible by agent',
  },
  {
    wide: true,
    tag: 'zkLogin',
    tagC: 'purple',
    title: 'zkLogin Ready',
    body: "Moby's policy architecture is compatible with Sui zkLogin — enabling agent wallets with social login and no seed phrase. Planned for mainnet deployment.",
    meta: 'Roadmap · Sui native',
  },
];

function FeatureGrid() {
  return (
    <section className="lp-features-wrap">
      <div style={{ marginBottom: 32 }}>
        <h2 className="section-h">Built on Sui primitives</h2>
        <p className="section-sub">
          No wrappers. No trusted intermediaries. Every guarantee enforced by
          Move.
        </p>
      </div>
      <div className="lp-features-bento">
        {FEATS.map((f, i) => (
          <div key={i} className={`feat-card${f.wide ? ' wide' : ''}`}>
            <div style={{ marginBottom: 16 }}>
              <Pill c={f.tagC}>{f.tag}</Pill>
            </div>
            <h3
              style={{
                fontSize: f.wide ? 22 : 18,
                fontWeight: 700,
                letterSpacing: '-0.025em',
                color: 'var(--ink)',
                marginBottom: 10,
              }}
            >
              {f.title}
            </h3>
            <p
              style={{
                fontSize: 14,
                color: 'var(--ink-2)',
                lineHeight: 1.72,
                marginBottom: 20,
                maxWidth: f.wide ? 600 : 280,
              }}
            >
              {f.body}
            </p>
            <span
              className="mono"
              style={{
                display: 'block',
                paddingTop: 16,
                borderTop: '1px solid var(--border)',
                color: 'var(--ink-3)',
              }}
            >
              {f.meta}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ── Footer ───────────────────────────────────────────────────────── */
function LandingFooter() {
  const footStyle: CSSProperties = {
    borderTop: '1px solid var(--border)',
    padding: '28px 32px',
    maxWidth: 1160,
    margin: '0 auto',
    display: 'flex',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'space-between',
    alignItems: 'center',
  };
  return (
    <footer style={footStyle}>
      <span
        style={{
          fontWeight: 700,
          fontSize: 15,
          letterSpacing: '-0.02em',
          color: 'var(--ink)',
        }}
      >
        Moby
      </span>
      <span className="mono">
        Autonomous Agent Wallet · Sui Overflow 2025 · Non-custodial · Move-native
      </span>
    </footer>
  );
}

/* ── GridPixelateIntro ────────────────────────────────────────────── */
function GridPixelateIntro() {
  const COLS = 16;
  const ROWS = 9;
  const DELAY_S = 0.15;
  const WAVE_S = 1.05;
  const CELL_S = 0.28;
  const TOTAL_MS = (DELAY_S + WAVE_S + CELL_S) * 1000 + 120;

  const [done, setDone] = useState(() => {
    const noMotion =
      typeof matchMedia !== 'undefined' &&
      matchMedia('(prefers-reduced-motion: reduce)').matches;
    const hidden =
      typeof document !== 'undefined' && document.visibilityState === 'hidden';
    return noMotion || hidden;
  });

  useEffect(() => {
    if (done) return;
    const finish = () => setDone(true);
    const id = setTimeout(finish, TOTAL_MS);
    const onVis = () => {
      if (document.visibilityState === 'visible') finish();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      clearTimeout(id);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [done, TOTAL_MS]);

  const cells = useMemo(() => {
    const cx = (COLS - 1) / 2;
    const cy = (ROWS - 1) / 2;
    const maxDist = Math.hypot(cx, cy);
    const out: number[] = [];
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        out.push(Math.hypot(x - cx, y - cy) / maxDist);
      }
    }
    return out;
  }, []);

  if (done) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 8000,
        display: 'grid',
        gridTemplateColumns: `repeat(${COLS}, 1fr)`,
        gridTemplateRows: `repeat(${ROWS}, 1fr)`,
        pointerEvents: 'none',
      }}
    >
      {cells.map((dist, i) => (
        <div
          key={i}
          className="gpw-cell"
          style={{
            backgroundColor: '#0C0E14',
            animationName: 'cell-out',
            animationDuration: `${CELL_S}s`,
            animationDelay: `${DELAY_S + dist * WAVE_S}s`,
            animationTimingFunction: 'ease-in',
            animationFillMode: 'forwards',
          }}
        />
      ))}
    </div>
  );
}

/* ── Page ─────────────────────────────────────────────────────────── */
export default function Landing() {
  return (
    <div className="lp-root">
      <GridPixelateIntro />
      <Nav />
      <main>
        <Hero />
        <CommandCenterDemo />
        <FeatureGrid />
      </main>
      <LandingFooter />
    </div>
  );
}
