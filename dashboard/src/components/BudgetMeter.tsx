import { TOKEN_SYMBOL } from '../lib/moby.config';

interface BudgetMeterProps {
  /** Remaining headroom under the ceiling (human units). */
  budget: number;
  /** The on-chain allowance ceiling (human units). */
  ceiling: number;
  pct: number;
  barColor: string;
}

/**
 * Move Policy ceiling tracker. The fill width + colour react to the remaining
 * on-chain allowance, transitioning green → orange → red as the budget depletes.
 */
export function BudgetMeter({ budget, ceiling, pct, barColor }: BudgetMeterProps) {
  return (
    <div className="budget">
      <div className="budget-row">
        <span className="budget-label">Move Policy ceiling</span>
        <span className="budget-value">
          {budget.toLocaleString()} / {ceiling.toLocaleString()} {TOKEN_SYMBOL}
        </span>
      </div>

      <div
        className="budget-bar-track"
        role="progressbar"
        aria-label="Policy allowance remaining"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        aria-valuetext={`${pct}% of the ${ceiling.toLocaleString()} ${TOKEN_SYMBOL} allowance remaining`}
      >
        <div
          className="budget-bar-fill"
          style={{ width: `${pct}%`, backgroundColor: barColor }}
        />
      </div>

      <div className="budget-row">
        <span className="mono">Allowance used</span>
        <span className="mono" style={{ color: barColor }}>
          {100 - pct}%
        </span>
      </div>
    </div>
  );
}
