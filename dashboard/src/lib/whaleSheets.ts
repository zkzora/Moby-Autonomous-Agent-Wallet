import type { WhaleMode, WhaleSheet } from './types';

/* ── Animated whale spritesheets (32px frames, looping) ──
   One sheet per mode. Resolution-independent: background-size normalises
   each strip to the display scale, so the PNG's real pixel size doesn't
   matter as long as it's N equal frames laid out horizontally.

   Frame counts verified against the source PNGs:
     moby_swimming.png  544×32 → 17 frames
     moby_sleep.png     512×32 → 16 frames
     moby_eating.png    544×32 → 17 frames                                */
export const WHALE_SHEETS: Record<WhaleMode, WhaleSheet> = {
  swim:  { src: '/moby_swimming.png', frames: 17, dur: 1.4 },
  sleep: { src: '/moby_sleep.png',    frames: 16, dur: 2.6 },
  eat:   { src: '/moby_eating.png',   frames: 17, dur: 1.0 },
};
