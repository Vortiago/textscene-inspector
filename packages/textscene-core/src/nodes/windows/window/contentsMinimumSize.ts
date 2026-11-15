/**
 * `Window::_get_contents_minimum_size` (`window.cpp:1839-1853`), the contents minimum an embedded
 * window's `wrap_controls` floors its size at, read from the rects and minimums the solve gave its
 * Controls. A subclass that overrides it registers a `MinimumSizeFn` instead (`wrapControls.ts`).
 */

import type { Vector2 } from '../../../godot/math/vector';
import type { SolvedControl } from '../../../r3f/controls/native/controlRectSolver';
import { isSceneChild, type SolveNode } from '../../../r3f/controls/native/solveTree';

/** The furthest corner of any child Control's `Point2i` position plus its `Size2i` combined minimum. */
export function windowContentsMinimumSize(
  window: SolveNode,
  solved: ReadonlyMap<string, SolvedControl>
): Vector2 {
  let x = 0;
  let y = 0;
  for (const child of window.children) {
    const entry = isSceneChild(window, child) ? solved.get(child.path) : undefined;
    if (!entry) continue;
    x = Math.max(x, Math.trunc(entry.rect.x) + Math.trunc(entry.minSize.x));
    y = Math.max(y, Math.trunc(entry.rect.y) + Math.trunc(entry.minSize.y));
  }
  return { x, y };
}
