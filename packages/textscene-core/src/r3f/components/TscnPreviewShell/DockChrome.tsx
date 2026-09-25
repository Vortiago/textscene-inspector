/** The Split Dock's resize handle and collapsed strip (ADR-0007). */
import { useRef, type PointerEvent as ReactPointerEvent } from 'react';
import styles from './TscnPreviewShell.module.css';

/**
 * The handle between the tree and the detail pane. `value` is the tree's
 * height fraction (0..1), clamped so neither section disappears.
 */
export function MasterDetailHandle({
  value,
  setValue,
}: {
  value: number;
  setValue: (v: number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  // Pointer capture, not window listeners, so an unmount mid-drag leaks no
  // listener and sets no value on an unmounted component.
  const dragging = useRef(false);

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    dragging.current = true;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* unsupported (test env) */
    }
  };
  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragging.current) return;
    const dock = ref.current?.parentElement;
    if (!dock) return;
    const rect = dock.getBoundingClientRect();
    if (rect.height <= 0) return;
    const frac = (e.clientY - rect.top) / rect.height;
    setValue(Math.min(0.8, Math.max(0.2, frac)));
  };
  const endDrag = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragging.current) return;
    dragging.current = false;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* unsupported (test env) */
    }
  };

  return (
    <div
      ref={ref}
      className={styles.masterDetailHandle}
      role="separator"
      aria-orientation="horizontal"
      aria-label="Resize the tree and detail sections"
      aria-valuenow={Math.round(value * 100)}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    />
  );
}

/** A collapsed dock: a thin clickable strip that re-opens the dock. */
export function CollapsedDock({ onExpand }: { onExpand: () => void }) {
  return (
    <button
      type="button"
      className={styles.collapsedDock}
      data-side="right"
      onClick={onExpand}
      title="Show the side panel"
      aria-label="Show the side panel"
    >
      <span className={styles.collapsedChevron}>‹</span>
      <span className={styles.collapsedTitle}>Scene</span>
    </button>
  );
}
