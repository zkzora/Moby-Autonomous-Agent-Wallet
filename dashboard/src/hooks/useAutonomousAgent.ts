import { useEffect, useRef } from 'react';
import { useSuiClient } from '@mysten/dapp-kit';
import { Transaction } from '@mysten/sui/transactions';
import { usePolicy } from '../providers/PolicyProvider';
import {
  AGENT_SECRET,
  MODULE,
  PACKAGE_ID,
  fromBaseUnits,
  shortAddress,
  toBaseUnits,
} from '../lib/moby.config';
import { getAgentAddress, getAgentKeypair } from '../lib/agentSigner';
import { publishSpend, publishAgentError } from '../lib/spendEvents';

/** localStorage flag the UI toggles to pause/resume autonomous execution. */
export const AUTO_PAUSE_KEY = 'moby:autoPaused';

const TICK_MS = 3500; // cadence at which the agent considers a trade
const MIN_SPEND = 3; // human token units per autonomous trade
const MAX_SPEND = 9;
const FAIL_BACKOFF = 4; // after N consecutive fails, skip this many ticks, then retry

/**
 * The autonomous agent loop. While a policy is active and delegated to the
 * dapp's agent keypair, this signs `record_spend` itself on a timer — debiting
 * the on-chain ceiling with no wallet popups. The whole UI re-syncs from the
 * refetched policy, so the budget bar depletes live as Moby "trades".
 *
 * Self-contained: every external value (client, policy, status, refetch) is read
 * through a ref so the interval is created ONCE on mount and never churns on a
 * re-render, a refetch, or a route transition. On repeated failures it backs off
 * for a few ticks and then retries — it never latches off permanently, so a
 * transient gas/tx hiccup can't freeze the budget for the rest of the session.
 */
export function useAutonomousAgent(): void {
  const client = useSuiClient();
  const { policy, status, refetch } = usePolicy();

  const clientRef = useRef(client);
  clientRef.current = client;
  const policyRef = useRef(policy);
  policyRef.current = policy;
  const statusRef = useRef(status);
  statusRef.current = status;
  const refetchRef = useRef(refetch);
  refetchRef.current = refetch;

  const inFlight = useRef(false);
  const fails = useRef(0);
  const cooldown = useRef(0); // ticks to skip after a failure burst

  useEffect(() => {
    if (!AGENT_SECRET) return;
    const keypair = getAgentKeypair();
    const agentAddr = getAgentAddress();
    if (!keypair || !agentAddr) return;

    const t = setInterval(async () => {
      if (inFlight.current) return;
      if (localStorage.getItem(AUTO_PAUSE_KEY) === '1') return;

      // Back off after a failure burst — but only skip a few ticks, then retry,
      // so a transient error (gas blip, version conflict) self-heals.
      if (cooldown.current > 0) {
        cooldown.current -= 1;
        return;
      }

      const p = policyRef.current;
      if (statusRef.current !== 'active' || !p || !p.isActive) return;
      // Only autonomous when the policy actually delegates to THIS agent.
      if (p.agent.toLowerCase() !== agentAddr.toLowerCase()) return;

      // Strict stop: nothing left under the ceiling → emit no trade, stay rested.
      const remaining = p.allowanceLimit - p.amountSpent;
      if (remaining <= 0n) return;

      inFlight.current = true;
      const sui = clientRef.current;
      try {
        const human =
          MIN_SPEND + Math.floor(Math.random() * (MAX_SPEND - MIN_SPEND + 1));
        const generated = toBaseUnits(human);
        // Clamp to the remaining allowance (bigint-safe min). When the budget is
        // nearly done this makes the FINAL trade land exactly on the ceiling —
        // e.g. 2 left → spend 2 → a perfect 50/50, never an over-budget 6.
        const amount = generated > remaining ? remaining : generated;

        const tx = new Transaction();
        tx.moveCall({
          target: `${PACKAGE_ID}::${MODULE}::record_spend`,
          arguments: [tx.object(p.policyId), tx.pure.u64(amount)],
        });
        const res = await sui.signAndExecuteTransaction({
          signer: keypair,
          transaction: tx,
        });
        // Explicitly announce the spend so the feed renders a SWAP row with the
        // exact clamped amount — independent of any re-render timing.
        publishSpend({ amountHuman: fromBaseUnits(amount), digest: res?.digest });
        fails.current = 0;
        // Read-after-write: block until the fullnode we read from has indexed
        // this tx, THEN refetch — otherwise the refetch reads the pre-spend
        // object version and the budget appears frozen until a manual refresh.
        if (res?.digest) {
          await sui.waitForTransaction({ digest: res.digest });
        }
        await refetchRef.current();
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        // A Move abort (e.g. EBudgetExceeded) is a contract decision, NOT a gas
        // problem — never flag those as "out of gas". Everything else that talks
        // about gas/coin balance is a real funding shortfall on the agent wallet.
        // Sui phrases this several ways ("Balance of gas object … is lower than…",
        // "GasBalanceTooLow", "Could not find enough gas/coins"), so match broadly
        // but only once a MoveAbort has been ruled out.
        const isMoveAbort = /MoveAbort|EBudgetExceeded|EPolicyRevoked/i.test(msg);
        const gasOut =
          !isMoveAbort &&
          /gas|InsufficientCoinBalance|GasBalanceTooLow|enough (gas|coins?)|lower than the needed/i.test(
            msg,
          );
        publishAgentError(
          gasOut
            ? `Agent out of gas — fund the agent wallet ${shortAddress(agentAddr)} to resume`
            : `record_spend failed — ${msg.slice(0, 120)}`,
        );
        fails.current += 1;
        if (fails.current >= 2) {
          cooldown.current = FAIL_BACKOFF;
          fails.current = 0;
        }
      } finally {
        inFlight.current = false;
      }
    }, TICK_MS);

    return () => clearInterval(t);
    // Mount-once: all live values are read through refs above, so the loop must
    // NOT depend on `client`/policy/etc — that would tear it down on every change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
