// ── Tunable engine constants (preserved from landing-v2.html) ─────────

/** Move Policy Object spend ceiling, in USDC. */
export const POLICY_CEILING = 500;

/** Budget the demo session opens with (10 USDC already spent). */
export const INITIAL_BUDGET = 490;

/** How often the live log stream emits a new event (ms). */
export const STREAM_INTERVAL_MS = 2400;

/** How often the agent state-text line rotates (ms). */
export const AGENT_TEXT_INTERVAL_MS = 2600;

/** How long the whale stays in `eat` mode after a fill (ms). */
export const EAT_DURATION_MS = 680;

/** Max log rows retained in the feed. */
export const MAX_LOG_ROWS = 9;

/** Per-swap budget deduction bounds (USDC). Formula: floor(random*12 + 5). */
export const SWAP_SPEND_BASE = 5;
export const SWAP_SPEND_SPREAD = 12;
