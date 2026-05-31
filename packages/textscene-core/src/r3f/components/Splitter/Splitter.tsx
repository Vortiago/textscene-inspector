/**
 * A vertical drag handle that resizes an adjacent dock column (the DCC-style
 * splitter between the shell's panels). Self-contained via pointer capture, so
 * the drag keeps tracking even when the pointer leaves the thin handle. Reports
 * the new clamped width through `setWidth`.
 *
 * `invert` flips the drag direction for a right-edge dock: for the LEFT dock the
 * handle sits on its right edge (drag right → wider, invert=false); for the
 * RIGHT dock the handle sits on its left edge (drag left → wider, invert=true).
 */

import { useRef, type PointerEvent as ReactPointerEvent } from 'react';
import styles from './Splitter.module.css';

export interface SplitterProps {
  width: number;
  setWidth: (w: number) => void;
  min?: number;
  max?: number;
  invert?: boolean;
  label: string;
}

export function Splitter({ width, setWidth, min = 180, max = 560, invert = false, label }: SplitterProps) {
  const drag = useRef({ startX: 0, startW: 0, active: false });

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    drag.current = { startX: e.clientX, startW: width, active: true };
    // Pointer capture keeps the drag tracking when the cursor leaves the thin
    // handle. Guarded: jsdom doesn't implement it.
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* unsupported (test env) */
    }
    e.preventDefault();
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!drag.current.active) return;
    const delta = e.clientX - drag.current.startX;
    const next = drag.current.startW + (invert ? -delta : delta);
    setWidth(Math.max(min, Math.min(max, next)));
  };

  const endDrag = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!drag.current.active) return;
    drag.current.active = false;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* unsupported (test env) */
    }
  };

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      className={styles.splitter}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    />
  );
}
