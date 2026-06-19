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
  CLOCK_ID,
  DEEP_SUI_POOL,
  DEEP_TYPE,
  DEFAULT_STRATEGY,
  IS_PACKAGE_DEPLOYED,
  MOBY_NETWORK,
  MODULE,
  PACKAGE_CALL_ID,
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
export type TxKind =
  | 'create'
  | 'topup'
  | 'revoke'
  | 'spend'
  | 'withdraw'
  | 'close';

/** Default policy lifetime (ms) — the on-chain expiry the agent trades within. */
export const DEFAULT_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

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
  /** Owner: escrow `escrowHuman` SUI as the budget, delegating to `agent`. */
  createPolicy: (agent: string, escrowHuman: number) => Promise<void>;
  /** Owner: escrow more SUI, raising the ceiling. */
  topUp: (amountHuman: number) => Promise<void>;
  revoke: () => Promise<void>;
  /** Agent-only: real DeepBook swap of `amountHuman` SUI → DEEP, floored by `minBaseOut`. */
  agentSwap: (amountHuman: number, minBaseOut?: bigint) => Promise<void>;
  /** Owner: reclaim `amountHuman` SUI of unspent escrow back to the owner. */
  withdraw: (amountHuman: number) => Promise<void>;
  /** Owner: drain the vault and close the policy permanently. */
  close: () => Promise<void>;
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
    async (agent: string, escrowHuman: number) => {
      await run('create', (tx) => {
        // Escrow `escrowHuman` SUI split off the gas coin; the escrowed amount
        // becomes the budget ceiling. Delegate trading on the DEEP/SUI pool.
        const [funds] = tx.splitCoins(tx.gas, [toBaseUnits(escrowHuman)]);
        tx.moveCall({
          target: `${PACKAGE_CALL_ID}::${MODULE}::create_policy`,
          arguments: [
            tx.pure.address(agent),
            tx.pure.id(DEEP_SUI_POOL),
            tx.pure.u64(BigInt(DEFAULT_DURATION_MS)),
            funds,
            tx.object(CLOCK_ID),
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
        const [funds] = tx.splitCoins(tx.gas, [toBaseUnits(amountHuman)]);
        tx.moveCall({
          target: `${PACKAGE_CALL_ID}::${MODULE}::top_up_allowance`,
          arguments: [tx.object(policy.policyId), funds],
        });
      });
    },
    [run, policy],
  );

  const revoke = useCallback(async () => {
    if (!policy) return;
    await run('revoke', (tx) => {
      tx.moveCall({
        target: `${PACKAGE_CALL_ID}::${MODULE}::revoke_policy`,
        arguments: [tx.object(policy.policyId)],
      });
    });
  }, [run, policy]);

  const agentSwap = useCallback(
    async (amountHuman: number, minBaseOut: bigint = 0n) => {
      if (!policy) return;
      const res = await run('spend', (tx) => {
        tx.moveCall({
          target: `${PACKAGE_CALL_ID}::${MODULE}::agent_swap`,
          typeArguments: [DEEP_TYPE],
          arguments: [
            tx.object(policy.policyId),
            tx.object(DEEP_SUI_POOL),
            tx.pure.u64(toBaseUnits(amountHuman)),
            tx.pure.u64(minBaseOut),
            tx.object(CLOCK_ID),
          ],
        });
      });
      // Announce the swap so the feed renders a SWAP row with the real amount.
      if (res) publishSpend({ amountHuman, digest: res.digest });
    },
    [run, policy],
  );

  const withdraw = useCallback(
    async (amountHuman: number) => {
      if (!policy) return;
      await run('withdraw', (tx) => {
        tx.moveCall({
          target: `${PACKAGE_CALL_ID}::${MODULE}::withdraw_unspent`,
          arguments: [
            tx.object(policy.policyId),
            tx.pure.u64(toBaseUnits(amountHuman)),
          ],
        });
      });
    },
    [run, policy],
  );

  const close = useCallback(async () => {
    if (!policy) return;
    await run('close', (tx) => {
      tx.moveCall({
        target: `${PACKAGE_CALL_ID}::${MODULE}::close_policy`,
        arguments: [tx.object(policy.policyId)],
      });
    });
  }, [run, policy]);

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
      agentSwap,
      withdraw,
      close,
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
      agentSwap,
      withdraw,
      close,
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
