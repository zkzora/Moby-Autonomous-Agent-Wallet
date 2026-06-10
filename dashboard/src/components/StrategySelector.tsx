import { usePolicy } from '../providers/PolicyProvider';
import { STRATEGIES } from '../lib/moby.config';

/**
 * The agent's "brain": a minimal radio-group selecting which micro-strategy
 * Moby runs inside the policy ceiling. Off-chain config (the strategy is an
 * input to the agent runner, not the Move object), persisted by PolicyProvider.
 *
 * The strategy is locked once a policy is active — it is a deploy-time choice,
 * so it can only be edited while configuring (before the agent is live). After
 * a revoke the panel returns to the deploy form, so it unlocks for the next
 * policy.
 */
export function StrategySelector() {
  const { strategy, setStrategy, status, policy } = usePolicy();
  // Editable before deploy and while the agent is resting (so a new strategy
  // can be chosen before "Reset & Top Up"); locked only while actively
  // executing against a live budget.
  const resting =
    !!policy &&
    policy.isActive &&
    policy.allowanceLimit > 0n &&
    policy.amountSpent >= policy.allowanceLimit;
  const locked = status === 'active' && !resting;

  return (
    <fieldset
      className="strategy"
      role="radiogroup"
      aria-label="Agent execution strategy"
      disabled={locked}
      title={locked ? 'Strategy is locked while the agent is live' : undefined}
    >
      <legend className="strategy-legend">
        <span className="mono" style={{ color: 'var(--ink-3)' }}>
          AGENT STRATEGY
        </span>
        {locked ? (
          <span className="strategy-lock mono">
            <svg
              width="9"
              height="11"
              viewBox="0 0 10 12"
              fill="none"
              aria-hidden="true"
            >
              <rect
                x="1.5"
                y="5"
                width="7"
                height="6"
                rx="1.2"
                stroke="currentColor"
              />
              <path
                d="M3.3 5V3.6a1.7 1.7 0 0 1 3.4 0V5"
                stroke="currentColor"
                strokeLinecap="round"
              />
            </svg>
            Locked
          </span>
        ) : (
          <span className="mono">AI brain</span>
        )}
      </legend>

      <div className="strategy-options">
        {STRATEGIES.map((s) => {
          const active = s.id === strategy;
          return (
            <button
              key={s.id}
              type="button"
              role="radio"
              aria-checked={active}
              aria-disabled={locked}
              disabled={locked}
              className={`strategy-opt${active ? ' is-active' : ''}`}
              onClick={locked ? undefined : () => setStrategy(s.id)}
            >
              <span className="strategy-dot" aria-hidden="true" />
              <span className="strategy-body">
                <span className="strategy-name">
                  {s.label}
                  <span className="strategy-pair">{s.pair}</span>
                </span>
                <span className="strategy-blurb">{s.blurb}</span>
              </span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
