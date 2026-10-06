/**
 * The Split Dock's handles, collapsed strip and narrow pane switcher (ADR-0007, ADR-0048).
 * The narrow-only parts render in every layout and the stylesheet hides them on a wide one,
 * so the layout switch needs no `matchMedia` listener.
 */
import { useRef, type PointerEvent as ReactPointerEvent } from 'react';
import styles from './TscnPreviewShell.module.css';

/** Which half of the dock the narrow layout shows. */
export type NarrowPane = 'tree' | 'details';

export function isNarrowPane(value: unknown): value is NarrowPane {
  return value === 'tree' || value === 'details';
}

const TREE_SHARE_MIN = 0.2;
const TREE_SHARE_MAX = 0.8;
const SHEET_SHARE_MIN = 0.25;
const SHEET_SHARE_MAX = 0.85;

/** A stored sheet share the grabber could have set. Anything else falls back to the default. */
export function isSheetShare(value: unknown): value is number {
  return typeof value === 'number' && value >= SHEET_SHARE_MIN && value <= SHEET_SHARE_MAX;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * A horizontal separator whose vertical drag reports the pointer's height fraction (0 at the
 * top) of the element `containerOf` picks. Pointer capture, not window listeners, so an
 * unmount mid-drag leaks no listener and sets no value on an unmounted component.
 */
function FractionHandle({
  containerOf,
  onFraction,
  value,
  className,
  label,
}: {
  containerOf: (handle: HTMLElement) => Element | null | undefined;
  onFraction: (fractionFromTop: number) => void;
  value: number;
  className: string | undefined;
  label: string;
}) {
  // The container's box, read once at pointerdown: the drag resizes what sits inside it, and
  // a read per move would force a layout after each custom-property write.
  const dragBox = useRef<DOMRect | null>(null);

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    const box = containerOf(e.currentTarget)?.getBoundingClientRect();
    dragBox.current = box && box.height > 0 ? box : null;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* unsupported (test env) */
    }
  };
  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const box = dragBox.current;
    if (!box) return;
    onFraction((e.clientY - box.top) / box.height);
  };
  const endDrag = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragBox.current) return;
    dragBox.current = null;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* unsupported (test env) */
    }
  };

  // Named handlers, not a spread: a JSX spread under r3f/ fails the material-factory guard.
  return (
    <div
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      className={className}
      role="separator"
      aria-orientation="horizontal"
      aria-label={label}
      aria-valuenow={Math.round(value * 100)}
    />
  );
}

/**
 * The handle between the tree and the detail pane. `value` is the tree's
 * height fraction (0..1), clamped so neither section disappears.
 */
export function MasterDetailHandle({ value, setValue }: { value: number; setValue: (v: number) => void }) {
  return (
    <FractionHandle
      containerOf={(handle) => handle.parentElement}
      onFraction={(fraction) => setValue(clamp(fraction, TREE_SHARE_MIN, TREE_SHARE_MAX))}
      value={value}
      className={styles.masterDetailHandle}
      label="Resize the tree and detail sections"
    />
  );
}

/**
 * The narrow layout's grabber on top of the bottom sheet. `value` is the sheet's fraction
 * of the column under the top bar, so a drag upwards grows it. It measures that column,
 * which the viewport and the sheet share.
 */
export function SheetHandle({ value, setValue }: { value: number; setValue: (v: number) => void }) {
  return (
    <FractionHandle
      containerOf={(handle) => handle.closest(`.${styles.columns}`)}
      onFraction={(fraction) => setValue(clamp(1 - fraction, SHEET_SHARE_MIN, SHEET_SHARE_MAX))}
      value={value}
      className={`${styles.narrowOnly} ${styles.sheetHandle}`}
      label="Resize the scene panel"
    />
  );
}

const NARROW_TABS: ReadonlyArray<[NarrowPane, string]> = [
  ['tree', 'Scene'],
  ['details', 'Details'],
];

/** The narrow layout's Scene | Details switch, with the sheet's collapse button. */
export function NarrowPaneSwitcher({
  pane,
  setPane,
  onCollapse,
}: {
  pane: NarrowPane;
  setPane: (pane: NarrowPane) => void;
  onCollapse: () => void;
}) {
  return (
    <div className={`${styles.narrowOnly} ${styles.narrowSwitcher}`}>
      <div className={styles.narrowTabs} role="tablist" aria-label="Scene panels">
        {NARROW_TABS.map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={pane === id}
            className={pane === id ? `${styles.paneTab} ${styles.paneTabActive}` : styles.paneTab}
            onClick={() => setPane(id)}
          >
            {label}
          </button>
        ))}
      </div>
      <button
        type="button"
        className={styles.collapseButton}
        onClick={onCollapse}
        title="Collapse the scene panel"
        aria-label="Collapse the scene panel"
      >
        ▾
      </button>
    </div>
  );
}

/**
 * A collapsed dock: a thin clickable strip that re-opens the dock. It is a vertical strip
 * right of the viewport, and a bar under it in the narrow layout. The stylesheet shows the
 * chevron that points the right way.
 */
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
      <span className={`${styles.collapsedChevron} ${styles.wideOnly}`}>‹</span>
      <span className={`${styles.collapsedChevron} ${styles.narrowOnly}`}>▴</span>
      <span className={styles.collapsedTitle}>Scene</span>
    </button>
  );
}
