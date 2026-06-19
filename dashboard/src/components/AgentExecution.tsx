import { usePolicy } from '../providers/PolicyProvider';
import {
  HAS_AUTONOMOUS_AGENT,
  MIN_SWAP_SUI,
  TOKEN_SYMBOL,
  BASE_SYMBOL,
  fromBaseUnits,
  shortAddress,
} from '../lib/moby.config';
import { getAgentAddress } from '../lib/agentSigner';
import { AUTO_PAUSE_KEY } from '../hooks/useAutonomousAgent';
import { useState } from 'react';

/** SUI debited per manual "Execute" click — one DeepBook tranche. */
const TRADE_STEP = MIN_SWAP_SUI;

/**
 * The on-chain execution proof. Every figure is read straight back from the
 * AgentPolicy object, and a trade is a real `agent_swap` testnet transaction
 * (SUI → DEEP on DeepBook), gated by the Move policy.
 *
 * Two modes:
 *   • Autonomous — the policy delegates to the dapp's agent keypair, which scores
 *     the live DeepBook book and auto-signs `agent_swap` (no wallet popups).
 *   • Manual — the policy delegates to the connected wallet, so the user signs
 *     each swap themselves via the Execute button.
 */
export function AgentExecution() {
  const { status, policy, isAgent, isOwner, agentSwap, close, pending, error, address } =
    usePolicy();
  const [paused, setPaused] = useState(
    () => localStorage.getItem(AUTO_PAUSE_KEY) === '1',
  );

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

  // Below one tranche, a DeepBook swap fills nothing — treat as resting.
  const exhausted = remaining < MIN_SWAP_SUI;
  const busy = pending !== null;
  // Unspent SUI still escrowed in the vault — reclaimable by the owner.
  const reclaimable = fromBaseUnits(policy.vault);

  function togglePause() {
    const next = !paused;
    setPaused(next);
    localStorage.setItem(AUTO_PAUSE_KEY, next ? '1' : '0');
  }

  async function handleTrade() {
    if (busy || exhausted || !isAgent) return;
    try {
      await agentSwap(TRADE_STEP); // real agent_swap: SUI → DEEP on DeepBook
    } catch {
      /* surfaced below via context error */
    }
  }

  async function handleClose() {
    if (busy || !isOwner) return;
    try {
      await close(); // drain vault → owner + revoke (reclaim dust below min size)
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
          <span className="budget-label">Spent / budget</span>
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
          aria-valuetext={`${usedPct}% of the on-chain budget spent`}
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
              Budget spent · agent resting
            </span>
          </div>
          {isOwner && reclaimable > 0 && (
            <button
              type="button"
              className="btn btn-solid exec-trade"
              onClick={handleClose}
              disabled={busy}
            >
              {pending === 'close'
                ? 'Reclaiming…'
                : `Reclaim ${reclaimable} ${TOKEN_SYMBOL} & close`}
            </button>
          )}
          <p className="exec-hint mono">
            {isOwner
              ? 'Top Up Allowance above to escrow more SUI, or reclaim the unspent dust (below the pool minimum) back to your wallet.'
              : 'The owner can top up the escrow to resume execution.'}
          </p>
        </>
      ) : isAutonomous ? (
        <>
          <div className="exec-auto">
            <span className="exec-auto-state mono">
              {paused ? 'Autonomous paused' : 'Autonomous · scoring DeepBook'}
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
            Moby's agent ({shortAddress(autoAddr)}) scores the live DeepBook
            spread and auto-signs <code>agent_swap</code> — no wallet popups.
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
              : `Execute swap · ${TRADE_STEP} ${TOKEN_SYMBOL} → ${BASE_SYMBOL}`}
          </button>
          {!error && (
            <p className="exec-hint mono">
              Signs <code>agent_swap</code> on testnet — a real DeepBook trade,
              gated by the Move policy.
            </p>
          )}
        </>
      ) : (
        <p className="exec-hint mono">
          {address
            ? `agent_swap is agent-gated. This policy delegates to ${shortAddress(
                policy.agent,
              )}.`
            : 'Connect the delegated agent wallet to execute trades.'}
        </p>
      )}

      {error && <p className="action-error">{error}</p>}
    </section>
  );
}
