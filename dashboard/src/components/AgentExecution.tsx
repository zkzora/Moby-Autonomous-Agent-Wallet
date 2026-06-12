import { useState } from 'react';
import { usePolicy } from '../providers/PolicyProvider';
import {
  HAS_AUTONOMOUS_AGENT,
  TOKEN_SYMBOL,
  fromBaseUnits,
  shortAddress,
} from '../lib/moby.config';
import { getAgentAddress } from '../lib/agentSigner';
import { AUTO_PAUSE_KEY } from '../hooks/useAutonomousAgent';

/** Human token units debited per manual "Execute" click. */
const TRADE_STEP = 25;

/**
 * The on-chain execution proof. Every figure is read straight back from the
 * AgentPolicy object, and spend is a real `record_spend` testnet transaction.
 *
 * Two modes:
 *   • Autonomous — the policy delegates to the dapp's agent keypair, which
 *     auto-signs `record_spend` (no wallet popups). We show live status + a
 *     pause control; the budget depletes on its own.
 *   • Manual — the policy delegates to the connected wallet, so the user signs
 *     each trade themselves via the Execute button.
 */
export function AgentExecution() {
  const {
    status,
    policy,
    isAgent,
    isOwner,
    recordSpend,
    reset,
    pending,
    error,
    address,
  } = usePolicy();
  const [paused, setPaused] = useState(
    () => localStorage.getItem(AUTO_PAUSE_KEY) === '1',
  );
  const [resetOk, setResetOk] = useState(false);

  // Only meaningful with a live, active policy.
  if (status !== 'active' || !policy) return null;

  const autoAddr = getAgentAddress();
  const isAutonomous =
    HAS_AUTONOMOUS_AGENT &&
    !!autoAddr &&
    policy.agent.toLowerCase() === autoAddr.toLowerCase();

  const limit = fromBaseUnits(policy.allowanceLimit);
  const spent = fromBaseUnits(policy.amountSpent);
  const remaining = Math.max(limit - spent, 0);
  const usedPct =
    limit > 0 ? Math.min(Math.round((spent / limit) * 100), 100) : 0;
  const barColor =
    usedPct < 40 ? 'var(--green)' : usedPct < 70 ? 'var(--orange)' : 'var(--red)';

  const exhausted = remaining <= 0;
  // True when allowance was reset to 0 (limit=0, spent=0) — agent is resting
  // waiting for a top-up, not waiting for a reset.
  const awaitingTopUp = policy.allowanceLimit === 0n && policy.amountSpent === 0n;
  const busy = pending !== null;
  const tradeAmount = Math.min(TRADE_STEP, remaining);

  function togglePause() {
    const next = !paused;
    setPaused(next);
    localStorage.setItem(AUTO_PAUSE_KEY, next ? '1' : '0');
  }

  async function handleTrade() {
    if (busy || exhausted || !isAgent) return;
    try {
      await recordSpend(tradeAmount);
    } catch {
      /* surfaced below via context error */
    }
  }

  async function handleReset() {
    if (busy || !isOwner) return;
    try {
      await reset(0); // zero amount_spent and set allowance_limit = 0
      setResetOk(true);
      setTimeout(() => setResetOk(false), 4000);
    } catch {
      /* surfaced below via context error */
    }
  }

  return (
    <section className="exec-card" aria-label="On-chain agent execution">
      <div className="exec-head">
        <span className="exec-title">Agent execution</span>
        <span className="exec-tag mono">on-chain · testnet</span>
      </div>

      {/* Real ceiling, read back from the AgentPolicy shared object. */}
      <div className="budget">
        <div className="budget-row">
          <span className="budget-label">Spent / ceiling</span>
          <span className="budget-value">
            {spent.toLocaleString()} / {limit.toLocaleString()} {TOKEN_SYMBOL}
          </span>
        </div>
        <div
          className="budget-bar-track"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={usedPct}
          aria-valuetext={`${usedPct}% of the on-chain allowance spent`}
        >
          <div
            className="budget-bar-fill"
            style={{ width: `${usedPct}%`, backgroundColor: barColor }}
          />
        </div>
        <div className="budget-row">
          <span className="mono">Remaining</span>
          <span className="mono" style={{ color: barColor }}>
            {remaining.toLocaleString()} {TOKEN_SYMBOL}
          </span>
        </div>
      </div>

      {exhausted ? (
        <>
          <div className="exec-auto">
            <span className="exec-auto-state mono">
              {awaitingTopUp
                ? 'Allowance zeroed · top up to resume'
                : 'Ceiling reached · agent resting'}
            </span>
          </div>
          {awaitingTopUp ? (
            <p className="exec-hint mono">
              Use <strong>Top Up Allowance</strong> above to open a new budget —
              the agent resumes automatically once funds are added.
            </p>
          ) : isOwner ? (
            <>
              <button
                type="button"
                className="btn btn-solid exec-trade"
                onClick={handleReset}
                disabled={busy}
              >
                {pending === 'reset' ? 'Resetting…' : 'Reset Allowance'}
              </button>
              <p className="exec-hint mono">
                Calls <code>reset_policy(0)</code> — zeroes spend and allowance.
                Top up to open a new budget, then pick a strategy to resume.
              </p>
            </>
          ) : (
            <p className="exec-hint mono">
              Only the policy owner can reset the budget.
            </p>
          )}
        </>
      ) : isAutonomous ? (
        <>
          <div className="exec-auto">
            <span className="exec-auto-state mono">
              {paused
                ? 'Autonomous paused'
                : 'Autonomous · signing record_spend'}
            </span>
            <button
              type="button"
              className="btn btn-ghost exec-pause"
              onClick={togglePause}
              disabled={exhausted}
            >
              {paused ? 'Resume' : 'Pause'}
            </button>
          </div>
          <p className="exec-hint mono">
            Moby's agent ({shortAddress(autoAddr)}) auto-signs on testnet —
            budget depletes with no wallet popups.
          </p>
        </>
      ) : isAgent ? (
        <>
          <button
            type="button"
            className="btn btn-solid exec-trade"
            onClick={handleTrade}
            disabled={busy || exhausted || !isAgent}
          >
            {pending === 'spend'
              ? 'Signing…'
              : exhausted
                ? 'Ceiling reached'
                : `Execute mock trade · −${tradeAmount} ${TOKEN_SYMBOL}`}
          </button>
          {!error && (
            <p className="exec-hint mono">
              Signs <code>record_spend</code> on testnet — the ceiling is
              enforced in Move, not the UI.
            </p>
          )}
        </>
      ) : (
        <p className="exec-hint mono">
          {address
            ? `record_spend is agent-gated. This policy delegates to ${shortAddress(
                policy.agent,
              )}.`
            : 'Connect the delegated agent wallet to execute trades.'}
        </p>
      )}

      {resetOk && (
        <p className="exec-success mono">
          Policy reset · ready for a new strategy
        </p>
      )}
      {error && <p className="action-error">{error}</p>}
    </section>
  );
}
