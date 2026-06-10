import { useState } from 'react';
import { usePolicy } from '../providers/PolicyProvider';
import { useMobyAgent } from '../hooks/useMobyAgent';
import { TOKEN_SYMBOL } from '../lib/moby.config';

/**
 * The two-button control rail under the whale tank, shown while a policy is
 * active: a ghost "Top Up Allowance" (reveals an inline amount field) and the
 * high-contrast red "Revoke Agent Access" kill-switch. A successful on-chain
 * revoke also puts the simulation whale to sleep so the visual matches reality.
 */
export function PolicyActions() {
  const { topUp, revoke, pending, error } = usePolicy();
  const { revoke: sleepWhale, revoked: simRevoked } = useMobyAgent();

  const [topUpOpen, setTopUpOpen] = useState(false);
  const [amount, setAmount] = useState('100');

  const amountNum = Number(amount);
  const amountOk = Number.isFinite(amountNum) && amountNum > 0;
  const busy = pending !== null;

  async function handleTopUp() {
    if (!amountOk || busy) return;
    try {
      await topUp(amountNum);
      setTopUpOpen(false);
    } catch {
      /* error surfaced in the activity area */
    }
  }

  async function handleRevoke() {
    if (busy || simRevoked) return;
    try {
      await revoke();
      sleepWhale(); // mirror on-chain revocation in the live demo
    } catch {
      /* error surfaced via context */
    }
  }

  return (
    <div className="policy-actions">
      {topUpOpen && (
        <div className="topup-row">
          <div className="field-affix">
            <input
              className="field-input"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="100"
              aria-label={`Top-up amount in ${TOKEN_SYMBOL}`}
              autoFocus
              disabled={busy}
            />
            <span className="field-suffix">{TOKEN_SYMBOL}</span>
          </div>
          <button
            type="button"
            className="btn btn-solid topup-confirm"
            onClick={handleTopUp}
            disabled={!amountOk || busy}
          >
            {pending === 'topup' ? 'Signing…' : 'Add'}
          </button>
        </div>
      )}

      <div className="action-rail">
        <button
          type="button"
          className="btn btn-ghost action-topup"
          onClick={() => setTopUpOpen((o) => !o)}
          disabled={busy}
          aria-expanded={topUpOpen}
        >
          ↑ Top Up Allowance
        </button>

        <button
          type="button"
          className="btn-revoke action-revoke"
          onClick={handleRevoke}
          disabled={busy || simRevoked}
          aria-label="Revoke agent access permanently on-chain"
        >
          {pending === 'revoke' ? 'Revoking…' : '⊗ Revoke Agent Access'}
        </button>
      </div>

      {error && <p className="action-error">{error}</p>}
    </div>
  );
}
