import type { CSSProperties, ReactNode } from 'react';
import type { PillColor } from '../lib/types';

const CLS: Record<PillColor, string> = {
  lime: 'pill pill-lime',
  orange: 'pill pill-orange',
  blue: 'pill pill-blue',
  purple: 'pill pill-purple',
  red: 'pill pill-red',
  green: 'pill pill-green',
  outline: 'pill pill-outline',
};

interface PillProps {
  c?: PillColor;
  children: ReactNode;
  style?: CSSProperties;
}

/** The brand's core visual primitive — the capsule pill. */
export function Pill({ c = 'lime', children, style }: PillProps) {
  return (
    <span className={CLS[c] ?? CLS.lime} style={style}>
      {children}
    </span>
  );
}
