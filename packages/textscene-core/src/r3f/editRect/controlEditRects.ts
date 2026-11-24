import type { Rect2 } from '../../godot/math/rect2.js';
import { joinPath } from '../../utils/nodePath.js';
import type { SolvedControl } from '../controls/native/controlRectSolver.js';
import { eachSolveNode } from '../controls/native/solvedSortInputs.js';
import type { SolveNode } from '../controls/native/solveTree.js';

/** Each solved Control's `_edit_get_rect` (control.cpp:177-183), by live path. */
export function controlEditRectsOf(
  tree: readonly SolveNode[],
  solved: ReadonlyMap<string, SolvedControl>,
  livePath: string
): ReadonlyMap<string, Rect2> {
  const rects = new Map<string, Rect2>();
  eachSolveNode(tree, (node) => {
    const entry = solved.get(node.path);
    if (entry) rects.set(joinPath(livePath, node.path), { x: 0, y: 0, w: entry.rect.w, h: entry.rect.h });
  });
  return rects;
}
