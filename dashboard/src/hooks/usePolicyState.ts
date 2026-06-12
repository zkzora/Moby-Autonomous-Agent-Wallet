import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { useSuiClient } from '@mysten/dapp-kit';
import {
  CREATED_EVENT_TYPE,
  IS_PACKAGE_DEPLOYED,
  MOBY_NETWORK,
  PACKAGE_ID,
  POLICY_TYPE,
} from '../lib/moby.config';

/** The live, parsed shape of an on-chain `AgentPolicy` object. */
export interface OnChainPolicy {
  policyId: string;
  owner: string;
  agent: string;
  allowanceLimit: bigint;
  amountSpent: bigint;
  isActive: boolean;
}

/** Raw Move object field shape returned by `getObject` for an AgentPolicy. */
interface PolicyFields {
  owner: string;
  agent: string;
  allowance_limit: string;
  amount_spent: string;
  is_active: boolean;
}

/** Raw `PolicyCreated` event payload. */
interface CreatedEventJson {
  policy_id: string;
  owner: string;
  agent: string;
  allowance_limit: string;
}

/**
 * Discover and read the connected owner's *active* `AgentPolicy` from chain.
 *
 * Discovery is on-chain truth (the local cache is only a hint):
 *   1. Gather candidate ids — the cached `knownPolicyId` (fast path) plus every
 *      `PolicyCreated` this owner has emitted (newest first).
 *   2. Read them all in one `multiGetObjects` and return the first **active**
 *      one. This is what lets a freshly deployed policy take over after a
 *      kill-switch: revoke is permanent, so the old object lingers as inactive,
 *      and we must skip past it to the new active policy rather than latch on.
 *   3. If none are active, return the newest owned (revoked) policy so the UI
 *      can show that state. Returns `null` when the owner has no policy at all.
 */
export function usePolicyState(
  address: string | undefined,
  knownPolicyId: string | null,
): UseQueryResult<OnChainPolicy | null> {
  const client = useSuiClient();

  return useQuery<OnChainPolicy | null>({
    queryKey: ['moby', 'policy', MOBY_NETWORK, PACKAGE_ID, address, knownPolicyId],
    enabled: IS_PACKAGE_DEPLOYED && !!address,
    queryFn: async () => {
      const owner = address as string;

      // 1 — candidate policy ids: cached hint first, then every policy this
      // owner created (newest → oldest), de-duplicated.
      const ids: string[] = [];
      if (knownPolicyId) ids.push(knownPolicyId);

      const events = await client.queryEvents({
        query: { MoveEventType: CREATED_EVENT_TYPE },
        order: 'descending',
        limit: 50,
      });
      for (const e of events.data) {
        const j = e.parsedJson as CreatedEventJson | undefined;
        if (j?.owner === owner && j.policy_id && !ids.includes(j.policy_id)) {
          ids.push(j.policy_id);
        }
      }
      if (ids.length === 0) return null;

      // 2 — read live state for every candidate in one round-trip.
      const objs = await client.multiGetObjects({
        ids,
        options: { showContent: true },
      });

      const parse = (
        res: Awaited<ReturnType<typeof client.multiGetObjects>>[number],
      ): OnChainPolicy | null => {
        const data = res.data;
        const content = data?.content;
        if (!data || !content || content.dataType !== 'moveObject') return null;
        if (content.type !== POLICY_TYPE) return null; // stale package version
        const f = content.fields as unknown as PolicyFields;
        if (f.owner !== owner) return null; // may belong to another account
        return {
          policyId: data.objectId,
          owner: f.owner,
          agent: f.agent,
          allowanceLimit: BigInt(f.allowance_limit),
          amountSpent: BigInt(f.amount_spent),
          isActive: Boolean(f.is_active),
        };
      };

      // 3 — prefer the first ACTIVE policy; otherwise fall back to the newest
      // owned (revoked) one so the UI reflects the kill-switch state.
      let fallback: OnChainPolicy | null = null;
      for (const res of objs) {
        const p = parse(res);
        if (!p) continue;
        if (p.isActive) return p;
        if (!fallback) fallback = p;
      }
      return fallback;
    },
  });
}
