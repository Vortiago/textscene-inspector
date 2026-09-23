/**
 * A vertical drag handle that resizes an adjacent dock column and reports the
 * clamped width through `setWidth`. `invert` is for a right-edge dock, whose
 * handle sits on its left edge, so a drag to the left widens it.
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
    // Pointer capture keeps the drag tracking off the thin handle. The test DOM
    // lacks it, hence the guard.
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
