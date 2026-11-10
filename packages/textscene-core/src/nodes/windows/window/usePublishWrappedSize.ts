/**
 * Publishes the size `wrap_controls` gives an embedded window (`wrapControls.ts`) as its viewport
 * rect, which its target, its Controls and its embedder's frame all read. Nothing is published while
 * the loaded size holds the Controls.
 */
import { useEffect, useMemo } from 'react';
import type { Vector2 } from '../../../godot/math/vector';
import { useRegisterViewportRect } from '../../../r3f/contexts/ViewportRectContext';
import type { NativeTheme } from '../../../r3f/controls/native/nativeTheme';
import type { SolveNode } from '../../../r3f/controls/native/solveTree';
import type { TextMeasurer } from '../../../r3f/controls/native/solverRegistry';
import { wrappedWindowSize } from './wrapControls';
import type { WindowProperties } from './types';

/** `window` is the root of the window's own forest, or `null` for a viewport that is no window. */
export function usePublishWrappedSize(
  path: string,
  window: SolveNode | null,
  theme: NativeTheme,
  measureText: TextMeasurer | null,
  generation: number,
  embedderSize: Vector2
): void {
  const registerViewportRect = useRegisterViewportRect();
  const wrapped = useMemo(
    () => (window ? wrappedWindowSize(window, theme, measureText, embedderSize) : null),
    // `generation` is a cache-buster, not read inside: a font or StyleBox that settles changes the
    // minimums without changing `window`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [window, theme, measureText, generation, embedderSize]
  );
  const loaded = window ? (window.node.properties as WindowProperties).size : null;
  const grows = wrapped !== null && loaded !== null && (wrapped.x !== loaded.x || wrapped.y !== loaded.y);
  const x = wrapped?.x ?? 0;
  const y = wrapped?.y ?? 0;
  useEffect(
    () => (grows ? registerViewportRect(path, { x, y }) : undefined),
    [registerViewportRect, path, grows, x, y]
  );
}
