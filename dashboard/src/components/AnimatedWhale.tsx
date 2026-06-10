import type { CSSProperties } from 'react';
import { WHALE_SHEETS } from '../lib/whaleSheets';
import type { WhaleMode } from '../lib/types';

interface AnimatedWhaleProps {
  mode?: WhaleMode;
  /** Base pixel unit. px=8 → 128px display frame (px * 16). */
  px?: number;
}

/**
 * Sprite-sheet whale. Each mode is N equal 32px frames laid out horizontally;
 * `background-size` normalises the strip to the display scale so every frame
 * lands exactly on a `size`-px boundary (no sideways drift). The CSS
 * `steps(frames)` playhead walks `--sheet-w` (the full strip width, negative).
 *
 * Each mode — swim / eat / sleep — is its own sprite sheet, shown verbatim.
 */
export function AnimatedWhale({ mode = 'swim', px = 8 }: AnimatedWhaleProps) {
  const cfg = WHALE_SHEETS[mode] ?? WHALE_SHEETS.swim;
  const size = px * 16; // px=8 → 128px display frame
  const sheetW = size * cfg.frames; // full strip width at display scale

  const spriteStyle: CSSProperties & Record<'--sheet-w', string> = {
    width: size,
    height: size,
    backgroundImage: `url('${cfg.src}')`,
    backgroundRepeat: 'no-repeat',
    backgroundSize: `${sheetW}px ${size}px`,
    '--sheet-w': `-${sheetW}px`,
    animation: `moby-sprite ${cfg.dur}s steps(${cfg.frames}) infinite`,
  };

  return (
    <div
      style={{ position: 'relative', display: 'inline-block', lineHeight: 0 }}
      role="img"
      aria-label={`Moby whale — ${mode}`}
    >
      <div className="moby-sprite" style={spriteStyle} />
    </div>
  );
}
