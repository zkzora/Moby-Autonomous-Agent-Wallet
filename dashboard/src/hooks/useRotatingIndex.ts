import { useEffect, useRef, useState } from 'react';

/**
 * Cycles an index 0..length-1 every `intervalMs`, pausing (but NOT resetting)
 * when `active` is false. Used for the agent state-text loop beneath the whale.
 *
 * The interval is created once and kept alive for the component's life — `active`
 * is read through a ref inside each tick rather than being an effect dependency.
 * This is deliberate: gating on `active` as a dep would tear the timer down and
 * recreate it on every flicker (e.g. a brief phase change during an on-chain
 * refetch or a route transition), which resets the cycle and visibly freezes the
 * text. Reading it via a ref lets the cadence survive those flickers.
 */
export function useRotatingIndex(
  length: number,
  intervalMs: number,
  active: boolean,
): number {
  const [index, setIndex] = useState(0);

  const activeRef = useRef(active);
  activeRef.current = active;

  useEffect(() => {
    if (length <= 0) return;
    const t = setInterval(() => {
      if (!activeRef.current) return; // paused — hold position, keep the timer
      setIndex((i) => (i + 1) % length);
    }, intervalMs);
    return () => clearInterval(t);
  }, [length, intervalMs]);

  return index;
}
