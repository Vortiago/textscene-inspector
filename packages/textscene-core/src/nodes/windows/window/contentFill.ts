/** The two steps a Window's content rect takes for the Controls it holds: size the largest, give each the same rect. */

import type { Rect2 } from '../../../godot/math/rect2';
import type { Vector2 } from '../../../godot/math/vector';
import { isLaidOutChild, type SolveNode } from '../../../r3f/controls/native/solveTree';
import type { SolveContext } from '../../../r3f/controls/native/solverRegistry';

/** The largest combined minimum on each axis among the children `parent` lays out (`popup.cpp:270-292`, `dialogs.cpp:281-300`). */
export function largestLaidOutChildMinimum(
  parent: SolveNode,
  ctx: Pick<SolveContext, 'combinedMinimumSize'>
): Vector2 {
  let x = 0;
  let y = 0;
  for (const child of parent.children) {
    if (!isLaidOutChild(parent, child)) continue;
    const childMin = ctx.combinedMinimumSize(child);
    x = Math.max(x, childMin.x);
    y = Math.max(y, childMin.y);
  }
  return { x, y };
}

/** Every child takes `rect` (`popup.cpp:346-368`, `dialogs.cpp:249-259`). */
export function everyChildFills(children: readonly { node: SolveNode }[], rect: Rect2): Map<string, Rect2> {
  return new Map(children.map(({ node }) => [node.path, rect]));
}
