/**
 * A tiny synchronous pub/sub for confirmed `record_spend` transactions.
 *
 * The signer (the autonomous agent loop, or the manual button) lives OUTSIDE
 * `MobyAgentProvider`, so it can't call `setLogs` directly. Instead it publishes
 * the spend here the moment the tx lands, and the feed subscribes — guaranteeing
 * a SWAP log row for every real spend (no reliance on indirectly observing the
 * on-chain `amount_spent` climb, which was unreliable).
 */
export interface SpendEvent {
  /** The exact clamped amount that hit `record_spend`, in human token units. */
  amountHuman: number;
  /** Transaction digest, for the Suiscan explorer link. */
  digest?: string;
}

type Listener = (e: SpendEvent) => void;

const listeners = new Set<Listener>();

/** Emit a confirmed spend to every subscriber. */
export function publishSpend(event: SpendEvent): void {
  for (const l of listeners) l(event);
}

/** Subscribe to spend events; returns an unsubscribe fn. */
export function subscribeSpend(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/* ── Agent error channel ───────────────────────────────────────────────────
   When the autonomous loop's `record_spend` throws (the usual culprit being the
   agent wallet out of gas), the error was previously swallowed silently — making
   a dead agent look identical to a working one. Surface it to the feed instead. */
type ErrListener = (message: string) => void;
const errListeners = new Set<ErrListener>();

export function publishAgentError(message: string): void {
  for (const l of errListeners) l(message);
}

export function subscribeAgentError(listener: ErrListener): () => void {
  errListeners.add(listener);
  return () => {
    errListeners.delete(listener);
  };
}
