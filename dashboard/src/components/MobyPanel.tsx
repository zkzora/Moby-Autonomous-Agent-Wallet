import { useMobyAgent } from '../hooks/useMobyAgent';
import { useRotatingIndex } from '../hooks/useRotatingIndex';
import { AGENT_MSGS } from '../lib/logData';
import { AGENT_TEXT_INTERVAL_MS } from '../lib/constants';
import { usePolicy } from '../providers/PolicyProvider';
import { AnimatedWhale } from './AnimatedWhale';
import { Pill } from './Pill';
import { PolicyForm } from './PolicyForm';
import { PolicyActions } from './PolicyActions';

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
  const { status } = usePolicy();

  if (status === 'loading') {
    return (
      <div className="panel-loading">
        <span className="mono">Reading policy from chain…</span>
      </div>
    );
  }

  return status === 'active' ? <AgentTank /> : <PolicyForm />;
}
