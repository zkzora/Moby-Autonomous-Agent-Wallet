import { useState } from 'react';
import { usePolicy } from '../providers/PolicyProvider';
import {
  DEFAULT_AGENT_ADDRESS,
  HAS_AUTONOMOUS_AGENT,
  TOKEN_SYMBOL,
  shortAddress,
} from '../lib/moby.config';
import { WalletButton } from './WalletButton';

/** A 0x-prefixed 32-byte Sui address. */
function isValidSuiAddress(addr: string): boolean {
  return /^0x[0-9a-fA-F]{64}$/.test(addr.trim());
}

/**
 * Shown in the left panel whenever the connected owner has no active policy.
 * Collects the allowance ceiling + delegated agent, then deploys the
 * `AgentPolicy` shared object via the PolicyProvider's `create_policy` call.
 */
export function PolicyForm() {
  const { status, createPolicy, pending, error, address } = usePolicy();
  const [allowance, setAllowance] = useState('500');
  const [agent, setAgent] = useState(DEFAULT_AGENT_ADDRESS);

  // Single-wallet demo affordance: delegate to the connected wallet so the
  // judge can both create the policy and execute trades from one account.
  const isSelfAgent =
    !!address && agent.trim().toLowerCase() === address.toLowerCase();

  // Default delegate is Moby's autonomous agent — it auto-signs record_spend.
  const isAutoAgent =
    HAS_AUTONOMOUS_AGENT &&
    agent.trim().toLowerCase() === DEFAULT_AGENT_ADDRESS.toLowerCase();

  const undeployed = status === 'undeployed';
  const disconnected = status === 'disconnected';
  const revoked = status === 'revoked';

  const allowanceNum = Number(allowance);
  const allowanceOk = Number.isFinite(allowanceNum) && allowanceNum > 0;
  const agentOk = isValidSuiAddress(agent);
  const busy = pending === 'create';
  const canDeploy = allowanceOk && agentOk && !busy && !disconnected && !undeployed;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canDeploy) return;
    try {
      await createPolicy(agent.trim(), allowanceNum);
    } catch {
      /* error surfaced via context */
    }
  }

  return (
    <form className="policy-form" onSubmit={handleSubmit}>
      <div className="policy-form-head">
        <h2 className="policy-form-title">
          {revoked ? 'Deploy a fresh policy' : 'Configure agent policy'}
        </h2>
        <p className="policy-form-sub">
          {revoked
            ? 'The previous capability was destroyed on-chain. Deploy a new ceiling to re-delegate.'
            : 'Set a hard spend ceiling and the agent it governs. Funds never leave your wallet.'}
        </p>
      </div>

      <label className="field">
        <span className="field-label">Allowance limit ({TOKEN_SYMBOL})</span>
        <div className="field-affix">
          <input
            className="field-input"
            inputMode="decimal"
            value={allowance}
            onChange={(e) => setAllowance(e.target.value)}
            placeholder="500"
            aria-invalid={!allowanceOk}
            disabled={busy}
          />
          <span className="field-suffix">{TOKEN_SYMBOL}</span>
        </div>
        {!allowanceOk && allowance !== '' && (
          <span className="field-hint field-hint-err">
            Enter an amount greater than zero.
          </span>
        )}
      </label>

      <label className="field">
        <div className="field-label-row">
          <span className="field-label">Agent wallet address</span>
          {address && !isSelfAgent && (
            <button
              type="button"
              className="field-link"
              onClick={() => setAgent(address)}
              disabled={busy}
            >
              Use my wallet
            </button>
          )}
        </div>
        <input
          className="field-input field-mono"
          value={agent}
          onChange={(e) => setAgent(e.target.value)}
          placeholder="0x…"
          spellCheck={false}
          aria-invalid={!agentOk}
          disabled={busy}
        />
        <span className={`field-hint${agentOk ? '' : ' field-hint-err'}`}>
          {agentOk
            ? isAutoAgent
              ? `Delegating to Moby's autonomous agent ${shortAddress(
                  agent.trim(),
                )} · auto-executes`
              : `Delegating to ${shortAddress(agent.trim())}${
                  isSelfAgent ? ' · this wallet (manual)' : ''
                }`
            : 'Must be a 0x-prefixed 32-byte address.'}
        </span>
      </label>

      {undeployed && (
        <div className="form-notice">
          Package not deployed yet. Publish <code>moby_policy</code> to testnet
          and set <code>VITE_MOBY_PACKAGE_ID</code> to enable deployment.
        </div>
      )}

      {error && <div className="form-notice form-notice-err">{error}</div>}

      {disconnected ? (
        <div className="form-connect">
          <span className="field-hint">Connect a wallet to deploy.</span>
          <WalletButton />
        </div>
      ) : (
        <button
          type="submit"
          className="btn btn-solid policy-deploy"
          disabled={!canDeploy}
        >
          {busy ? 'Awaiting signature…' : 'Deploy Policy Object'}
        </button>
      )}
    </form>
  );
}
