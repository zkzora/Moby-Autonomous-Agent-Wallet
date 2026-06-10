import { useMobyAgent } from '../hooks/useMobyAgent';
import { BudgetMeter } from './BudgetMeter';
import { LogRow } from './LogRow';

/** Right panel: policy ceiling tracker + live on-chain activity feed. */
export function ActivityLog() {
  const { logs, budget, ceiling, pct, barColor } = useMobyAgent();

  return (
    <>
      <div className="log-head">
        <span className="mono" style={{ color: 'var(--ink-3)' }}>
          ON-CHAIN ACTIVITY LOG
        </span>
        <span className="mono">Live · Deepbook CLOB</span>
      </div>

      <BudgetMeter budget={budget} ceiling={ceiling} pct={pct} barColor={barColor} />

      <div
        className="log-list"
        role="log"
        aria-live="polite"
        aria-label="Live on-chain trade stream"
      >
        {logs.length === 0 ? (
          <div className="log-empty">
            <span className="mono" style={{ color: 'var(--ink-2)' }}>
              No on-chain activity yet
            </span>
            <span className="mono">Agent is idle — waiting for the next window</span>
          </div>
        ) : (
          logs.map((entry, i) => (
            <LogRow key={entry.id} entry={entry} fresh={i === 0} />
          ))
        )}
      </div>
    </>
  );
}
