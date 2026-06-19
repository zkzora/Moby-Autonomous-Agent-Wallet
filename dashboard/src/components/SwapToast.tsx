import { useEffect, useRef, useState } from 'react';
import { subscribeSpend } from '../lib/spendEvents';
import { txExplorerUrl } from '../lib/moby.config';

/**
 * A single bottom-right toast that pops the moment a real `agent_swap` lands,
 * so the on-chain proof isn't missed as the activity feed scrolls. Clickable →
 * Suiscan. Subscribes to the existing spend bus (success-only); skips/holds,
 * revoke/budget aborts, and withdraw/close never publish there, so they never
 * toast. The bus has no history buffer, so a reload replays nothing.
 */
const DISMISS_MS = 6000;

interface ToastData {
  id: number;
  amountIn: number;
  amountOut?: number;
  digest: string;
}

const fmt = (n: number) =>
  n.toLocaleString(undefined, { maximumFractionDigits: 3 });

export function SwapToast() {
  const [toast, setToast] = useState<ToastData | null>(null);
  const [leaving, setLeaving] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Subscribe once; each successful swap REPLACES the current toast (max 1).
  useEffect(() => {
    return subscribeSpend(({ amountHuman, amountOut, digest }) => {
      if (!digest) return; // only landed swaps with a verifiable tx
      setToast({ id: Date.now(), amountIn: amountHuman, amountOut, digest });
    });
  }, []);

  // (Re)arm the fade-out + dismiss whenever a new toast arrives.
  useEffect(() => {
    if (!toast) return;
    setLeaving(false);
    timers.current.forEach(clearTimeout);
    timers.current = [
      setTimeout(() => setLeaving(true), DISMISS_MS - 260),
      setTimeout(() => setToast(null), DISMISS_MS),
    ];
    return () => timers.current.forEach(clearTimeout);
  }, [toast]);

  if (!toast) return null;

  const short = `${toast.digest.slice(0, 6)}…${toast.digest.slice(-6)}`;

  return (
    <a
      key={toast.id}
      className={`swap-toast${leaving ? ' leaving' : ''}`}
      href={txExplorerUrl(toast.digest)}
      target="_blank"
      rel="noopener noreferrer"
    >
      <span className="swap-toast-title">✅ Swap executed</span>
      <span className="swap-toast-amt">
        {fmt(toast.amountIn)} SUI →{' '}
        {toast.amountOut != null ? fmt(toast.amountOut) : '~'} DEEP
      </span>
      <span className="swap-toast-tx mono">
        Tx: {short} ↗
      </span>
    </a>
  );
}
