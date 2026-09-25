/** The Source pane's persisted geometry, and the splitter drag that changes it. */

import { useCallback, useEffect, useRef, type MouseEvent as ReactMouseEvent } from 'react';
import { usePersistedState } from '@textscene/core';

const SOURCE_PANE_STORAGE_KEY = 'tscn-web-source-pane';

/** The Source pane's persisted shape: shown or hidden, and its dragged width. */
export interface SourcePaneState {
  visible: boolean;
  width: number;
}

const DEFAULT_SOURCE_PANE_STATE: SourcePaneState = { visible: true, width: 320 };

/** Reject a persisted shape with any missing or invalid field, in favour of the default. */
function isSourcePaneState(value: unknown): value is SourcePaneState {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.visible === 'boolean' &&
    typeof v.width === 'number' &&
    Number.isFinite(v.width) &&
    v.width > 0
  );
}

export interface SourcePaneControl {
  sourcePane: SourcePaneState;
  toggleVisible: () => void;
  onSplitterMouseDown: (e: ReactMouseEvent) => void;
}

export function useSourcePane(): SourcePaneControl {
  // Debounced, not a `useEffect` write per change: that puts a synchronous
  // `localStorage.setItem` on every splitter `mousemove`, inside the drag's frame budget.
  // The trailing write flushes on unmount and pagehide.
  const [sourcePane, setSourcePane] = usePersistedState(
    SOURCE_PANE_STORAGE_KEY,
    DEFAULT_SOURCE_PANE_STATE,
    isSourcePaneState
  );

  const splitterStartRef = useRef<number>(0);

  const onSplitterMove = useCallback(
    (e: MouseEvent) => {
      const dx = e.clientX - splitterStartRef.current;
      setSourcePane((prev) => ({
        ...prev,
        width: Math.max(180, Math.min(800, prev.width + dx)),
      }));
      splitterStartRef.current = e.clientX;
    },
    [setSourcePane]
  );

  // The mouse-up handler, which removes itself too. The unmount cleanup reuses it.
  const detachDragListeners = useCallback(() => {
    document.removeEventListener('mousemove', onSplitterMove);
    document.removeEventListener('mouseup', detachDragListeners);
  }, [onSplitterMove]);

  const onSplitterMouseDown = useCallback(
    (e: ReactMouseEvent) => {
      e.preventDefault();
      splitterStartRef.current = e.clientX;
      document.addEventListener('mousemove', onSplitterMove);
      document.addEventListener('mouseup', detachDragListeners);
    },
    [onSplitterMove, detachDragListeners]
  );

  // An unmount mid-drag must not leak document listeners or set state after unmount.
  useEffect(() => detachDragListeners, [detachDragListeners]);

  const toggleVisible = useCallback(
    () => setSourcePane((prev) => ({ ...prev, visible: !prev.visible })),
    [setSourcePane]
  );

  return { sourcePane, toggleVisible, onSplitterMouseDown };
}
