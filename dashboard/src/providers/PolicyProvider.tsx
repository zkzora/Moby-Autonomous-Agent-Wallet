import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  useCurrentAccount,
  useSignAndExecuteTransaction,
  useSuiClient,
} from '@mysten/dapp-kit';
import { Transaction } from '@mysten/sui/transactions';
import {
  DEFAULT_STRATEGY,
  IS_PACKAGE_DEPLOYED,
  MOBY_NETWORK,
  MODULE,
  PACKAGE_ID,
  toBaseUnits,
  type StrategyId,
} from '../lib/moby.config';
import { usePolicyState, type OnChainPolicy } from '../hooks/usePolicyState';
import { publishSpend } from '../lib/spendEvents';

/** Coarse lifecycle the UI branches on. */
export type PolicyStatus =
  | 'undeployed' // package id not wired in yet
  | 'disconnected' // no wallet connected
  | 'loading' // reading chain
  | 'none' // connected, no policy on chain
  | 'active' // policy exists and is_active
  | 'revoked'; // policy exists but revoked

/** A pending signature/execution, surfaced so buttons can show progress. */
export type TxKind = 'create' | 'topup' | 'revoke' | 'spend' | 'reset';

interface PolicyContextValue {
  status: PolicyStatus;
  policy: OnChainPolicy | null;
  isDeployed: boolean;
  address: string | undefined;
  /**
   * True when the connected wallet IS the policy's delegated agent — the only
   * party `record_spend` will accept. Gates the agent-execution control.
   */
  isAgent: boolean;
  /** True when the connected wallet owns the policy (revoke / top-up / reset). */
  isOwner: boolean;
  // chosen execution strategy (off-chain config)
  strategy: StrategyId;
  setStrategy: (id: StrategyId) => void;
  // transactions
  pending: TxKind | null;
  error: string | null;
  createPolicy: (agent: string, allowanceHuman: number) => Promise<void>;
  topUp: (amountHuman: number) => Promise<void>;
  revoke: () => Promise<void>;
  /** Owner-only: zero amount_spent (+ optional extra ceiling) for a clean slate. */
  reset: (extraHuman?: number) => Promise<void>;
  /** Agent-only: record a spend against the ceiling (depletes the budget). */
  recordSpend: (amountHuman: number) => Promise<void>;
  refetch: () => void;
}

const PolicyContext = createContext<PolicyContextValue | null>(null);

const strategyKey = `moby:strategy`;
const policyIdKey = (addr: string) => `moby:policyId:${MOBY_NETWORK}:${addr}`;

export function PolicyProvider({ children }: { children: ReactNode }) {
  const account = useCurrentAccount();
  const address = account?.address;

  const client = useSuiClient();
  const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction();

  // The id of a policy we already know about (just created, or cached from a
  // prior session) — lets the reader skip event discovery on reload.
  const [knownPolicyId, setKnownPolicyId] = useState<string | null>(null);

  // Restore cached id when the connected account changes.
  useEffect(() => {
    if (!address) {
      setKnownPolicyId(null);
      return;
    }
    setKnownPolicyId(localStorage.getItem(policyIdKey(address)));
  }, [address]);

  const policyQuery = usePolicyState(address, knownPolicyId);
  const policy = policyQuery.data ?? null;

  // Keep the cache in sync with what discovery resolved — but only pin ACTIVE
  // policies. Caching a revoked id would make discovery latch onto the dead
  // policy forever; clearing it lets a fresh deploy be re-discovered.
  useEffect(() => {
    if (!address) return;
    if (policy?.policyId && policy.isActive) {
      localStorage.setItem(policyIdKey(address), policy.policyId);
    } else {
      localStorage.removeItem(policyIdKey(address));
    }
  }, [address, policy?.policyId, policy?.isActive]);

  // Strategy selection persists across reloads.
  const [strategy, setStrategyState] = useState<StrategyId>(() => {
    const saved =
      typeof localStorage !== 'undefined'
        ? localStorage.getItem(strategyKey)
        : null;
    return (saved as StrategyId) || DEFAULT_STRATEGY;
  });
  const setStrategy = useCallback((id: StrategyId) => {
    setStrategyState(id);
    localStorage.setItem(strategyKey, id);
  }, []);

  const [pending, setPending] = useState<TxKind | null>(null);
  const [error, setError] = useState<string | null>(null);

  const status: PolicyStatus = !IS_PACKAGE_DEPLOYED
    ? 'undeployed'
    : !address
      ? 'disconnected'
      : policyQuery.isLoading
        ? 'loading'
        : !policy
          ? 'none'
          : policy.isActive
            ? 'active'
            : 'revoked';

  // ── Transaction builders ──────────────────────────────────────────────
  // Each builds a PTB, signs+executes via the connected wallet, then refetches
  // so the UI reflects the new on-chain truth.

  const run = useCallback(
    async (kind: TxKind, build: (tx: Transaction) => void) => {
      if (!IS_PACKAGE_DEPLOYED) {
        setError('Package not deployed. Set VITE_MOBY_PACKAGE_ID first.');
        return;
      }
      setPending(kind);
      setError(null);
      try {
        const tx = new Transaction();
        build(tx);
        const res = await signAndExecute({ transaction: tx });
        // For a fresh create, capture the new shared object id eagerly.
        if (kind === 'create' && address) {
          // Discovery will resolve it; clear any stale known id so the event
          // scan runs and picks up the just-created policy.
          setKnownPolicyId(null);
          localStorage.removeItem(policyIdKey(address));
        }
        // Read-after-write: wait until the fullnode has indexed this tx so the
        // refetch reads the post-tx object state (not the stale prior version).
        if (res?.digest) {
          await client.waitForTransaction({ digest: res.digest });
        }
        // A fresh create also needs the PolicyCreated event indexed for the
        // discovery event-scan (separate from object indexing), so give it a beat.
        if (kind === 'create') {
          await new Promise((r) => setTimeout(r, 1200));
        }
        await policyQuery.refetch();
        return res;
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Transaction failed');
        throw e;
      } finally {
        setPending(null);
      }
    },
    [address, client, signAndExecute, policyQuery],
  );

  const createPolicy = useCallback(
    async (agent: string, allowanceHuman: number) => {
      await run('create', (tx) => {
        tx.moveCall({
          target: `${PACKAGE_ID}::${MODULE}::create_policy`,
          arguments: [
            tx.pure.address(agent),
            tx.pure.u64(toBaseUnits(allowanceHuman)),
          ],
        });
      });
    },
    [run],
  );

  const topUp = useCallback(
    async (amountHuman: number) => {
      if (!policy) return;
      await run('topup', (tx) => {
        tx.moveCall({
          target: `${PACKAGE_ID}::${MODULE}::top_up_allowance`,
          arguments: [
            tx.object(policy.policyId),
            tx.pure.u64(toBaseUnits(amountHuman)),
          ],
        });
      });
    },
    [run, policy],
  );

  const revoke = useCallback(async () => {
    if (!policy) return;
    await run('revoke', (tx) => {
      tx.moveCall({
        target: `${PACKAGE_ID}::${MODULE}::revoke_policy`,
        arguments: [tx.object(policy.policyId)],
      });
    });
  }, [run, policy]);

  const recordSpend = useCallback(
    async (amountHuman: number) => {
      if (!policy) return;
      const res = await run('spend', (tx) => {
        tx.moveCall({
          target: `${PACKAGE_ID}::${MODULE}::record_spend`,
          arguments: [
            tx.object(policy.policyId),
            tx.pure.u64(toBaseUnits(amountHuman)),
          ],
        });
      });
      // Announce the spend so the feed renders a SWAP row with the real amount.
      if (res) publishSpend({ amountHuman, digest: res.digest });
    },
    [run, policy],
  );

  const reset = useCallback(
    async (extraHuman = 0) => {
      if (!policy) return;
      await run('reset', (tx) => {
        tx.moveCall({
          target: `${PACKAGE_ID}::${MODULE}::reset_policy`,
          arguments: [
            tx.object(policy.policyId),
            tx.pure.u64(toBaseUnits(extraHuman)),
          ],
        });
      });
    },
    [run, policy],
  );

  // The connected wallet is the agent iff it matches the policy's delegate.
  // Sui addresses are canonical-lowercase, but compare defensively.
  const isAgent =
    !!address &&
    !!policy &&
    policy.agent.toLowerCase() === address.toLowerCase();

  // The connected wallet owns the policy (holds revoke / top-up / reset rights).
  const isOwner =
    !!address &&
    !!policy &&
    policy.owner.toLowerCase() === address.toLowerCase();

  const refetch = useCallback(() => {
    void policyQuery.refetch();
  }, [policyQuery]);

  const value = useMemo<PolicyContextValue>(
    () => ({
      status,
      policy,
      isDeployed: IS_PACKAGE_DEPLOYED,
      address,
      isAgent,
      isOwner,
      strategy,
      setStrategy,
      pending,
      error,
      createPolicy,
      topUp,
      revoke,
      recordSpend,
      reset,
      refetch,
    }),
    [
      status,
      policy,
      address,
      isAgent,
      isOwner,
      strategy,
      setStrategy,
      pending,
      error,
      createPolicy,
      topUp,
      revoke,
      recordSpend,
      reset,
      refetch,
    ],
  );

  return (
    <PolicyContext.Provider value={value}>{children}</PolicyContext.Provider>
  );
}

/** Consume Moby's on-chain policy state + actions. */
export function usePolicy(): PolicyContextValue {
  const ctx = useContext(PolicyContext);
  if (!ctx) {
    throw new Error('usePolicy must be used within a PolicyProvider');
  }
  return ctx;
}
