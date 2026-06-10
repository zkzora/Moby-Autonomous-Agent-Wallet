import { useMobyAgent, type AgentPhase } from '../hooks/useMobyAgent';
import { TOKEN_SYMBOL } from '../lib/moby.config';

const PHASE_LABEL: Record<AgentPhase, string> = {
  active: 'Executing',
  idle: 'Idle',
  sleeping: 'Resting',
  revoked: 'Revoked',
};

const PHASE_COLOR: Record<AgentPhase, string> = {
  active: 'var(--blue)',
  idle: 'var(--ink-3)',
  sleeping: 'var(--ink-2)',
  revoked: 'var(--red)',
};

interface StatProps {
  label: string;
  value: string;
  foot: string;
  footColor?: string;
}

function Stat({ label, value, foot, footColor }: StatProps) {
  return (
    <div className="stat-card">
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value}</span>
      <span className="stat-foot" style={footColor ? { color: footColor } : undefined}>
        {foot}
      </span>
    </div>
  );
}

/** Live session metrics — every budget figure reads from the on-chain policy. */
export function StatStrip() {
  const { ceiling, spent, budget, pct, barColor, tradeCount, eventCount, phase } =
    useMobyAgent();

  return (
    <div className="stat-strip">
      <Stat
        label="Policy ceiling used"
        value={`${spent.toLocaleString()} ${TOKEN_SYMBOL}`}
        foot={ceiling > 0 ? `${100 - pct}% of ${ceiling.toLocaleString()}` : 'no active policy'}
        footColor={ceiling > 0 ? barColor : undefined}
      />
      <Stat
        label="Allowance left"
        value={`${budget.toLocaleString()} ${TOKEN_SYMBOL}`}
        foot={ceiling > 0 ? `${pct}% remaining` : '—'}
        footColor={ceiling > 0 ? barColor : undefined}
      />
      <Stat
        label="Trades executed"
        value={String(tradeCount)}
        foot={`${eventCount} events streamed`}
      />
      <Stat
        label="Agent status"
        value={PHASE_LABEL[phase]}
        foot="deepbook/testnet"
        footColor={PHASE_COLOR[phase]}
      />
    </div>
  );
}
