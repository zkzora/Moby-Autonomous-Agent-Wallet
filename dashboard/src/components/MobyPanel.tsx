import { useMobyAgent } from '../hooks/useMobyAgent';
import { useRotatingIndex } from '../hooks/useRotatingIndex';
import { AGENT_MSGS } from '../lib/logData';
import { AGENT_TEXT_INTERVAL_MS } from '../lib/constants';
import { usePolicy } from '../providers/PolicyProvider';
import { fromBaseUnits, TOKEN_SYMBOL } from '../lib/moby.config';
import { AnimatedWhale } from './AnimatedWhale';
import { Pill } from './Pill';
import { PolicyForm } from './PolicyForm';
import { PolicyActions } from './PolicyActions';

/**
 * Shown above the deploy form when the owner has a REVOKED policy that still
 * holds escrowed SUI. Revoking only severs the agent (is_active=false) — it does
 * not move funds, so the vault stays reclaimable. `close_policy` is owner-only
 * and not gated by is_active, so the owner can always drain it back.
 */
function ReclaimBanner() {
  const { policy, close, pending, error } = usePolicy();
  if (!policy) return null;
  const amt = fromBaseUnits(policy.vault);
  return (
    <div className="reclaim-banner">
      <p className="exec-hint mono">
        Agent revoked · <strong>{amt} {TOKEN_SYMBOL}</strong> still escrowed in the
        old policy.
      </p>
      <button
        type="button"
        className="btn btn-solid"
        onClick={() => void close()}
        disabled={pending !== null}
      >
        {pending === 'close' ? 'Reclaiming…' : `Reclaim ${amt} ${TOKEN_SYMBOL}`}
      </button>
      {error && <p className="action-error">{error}</p>}
    </div>
  );
}

/** Status line content + colour for each lifecycle phase. */
function useStatusLine() {
  const { phase } = useMobyAgent();
  const idx = useRotatingIndex(
    AGENT_MSGS.length,
    AGENT_TEXT_INTERVAL_MS,
    phase === 'active',
  );

  switch (phase) {
    case 'revoked':
      return { color: 'var(--red)', text: '⊗ Agent connection severed on-chain' };
    case 'sleeping':
      return { color: 'var(--ink-3)', text: '… Budget ceiling reached · Agent resting' };
    case 'idle':
      return { color: 'var(--ink-3)', text: '○ Awaiting an active policy' };
    default:
      return { color: 'var(--blue)', text: `● ${AGENT_MSGS[idx]}` };
  }
}

/** The whale tank + live state line + on-chain action rail (active policy). */
function AgentTank() {
  const { phase, whaleMode, revoked } = useMobyAgent();
  const status = useStatusLine();
  const sleeping = whaleMode === 'sleep';

  return (
    <>
      {/* Whale tank — sprite animation preserved verbatim */}
      <div
        className={`whale-box${sleeping ? ' is-sleeping' : ''}${revoked ? ' is-revoked' : ''}`}
      >
        <div className="whale-dot-grid" />
        {phase === 'active' && <div className="scan-bar" />}

        <div className="whale-stage">
          <AnimatedWhale px={8} mode={whaleMode} />
        </div>

        {revoked && (
          <div className="revoke-overlay">
            <Pill c="red" style={{ fontSize: 10, letterSpacing: '0.07em' }}>
              ACCESS REVOKED
            </Pill>
          </div>
        )}
      </div>

      {/* State label (announced to assistive tech) */}
      <p
        className="agent-state"
        key={status.text}
        aria-live="polite"
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          color: status.color,
          textAlign: 'center',
          lineHeight: 1.5,
          minHeight: 16,
        }}
      >
        {status.text}
      </p>

      {/* Two-button rail: top up + on-chain kill-switch */}
      <PolicyActions />
    </>
  );
}

/**
 * Left panel. With an active on-chain policy it shows the live agent tank and
 * its action rail; otherwise it shows the policy configuration form. The form
 * also covers the pre-deployment and disconnected states.
 */
export function MobyPanel() {
  const { status, policy, isOwner } = usePolicy();

  if (status === 'loading') {
    return (
      <div className="panel-loading">
        <span className="mono">Reading policy from chain…</span>
      </div>
    );
  }

  if (status === 'active') return <AgentTank />;

  // Revoked policy that still holds escrow → surface a reclaim path above the
  // deploy form so the owner can recover funds before redeploying.
  const showReclaim =
    status === 'revoked' && isOwner && !!policy && policy.vault > 0n;

  return (
    <>
      {showReclaim && <ReclaimBanner />}
      <PolicyForm />
    </>
  );
}
