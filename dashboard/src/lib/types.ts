// ── Shared domain types ──────────────────────────────────────────────

/** Visual + behavioural modes for the sprite-sheet whale. */
export type WhaleMode = 'swim' | 'eat' | 'sleep';

/** Pill colour variants — mirrors the CSS `.pill-*` classes. */
export type PillColor =
  | 'lime'
  | 'orange'
  | 'blue'
  | 'purple'
  | 'red'
  | 'green'
  | 'outline';

/** Categories of on-chain activity, each with its own badge styling. */
export type LogType = 'swap' | 'scan' | 'limit' | 'policy';

/** A template entry in the simulated log pool (no identity yet). */
export interface LogTemplate {
  type: LogType;
  msg: string;
}

/** A materialised log row rendered in the feed. */
export interface LogEntry extends LogTemplate {
  id: number;
  /** Tx digest for rows backed by a real on-chain transaction (→ explorer). */
  digest?: string;
}

/** One spritesheet configuration (one per whale mode). */
export interface WhaleSheet {
  src: string;
  frames: number;
  /** Seconds for one full loop of the strip. */
  dur: number;
}
