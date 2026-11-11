/**
 * The y-sort of a Control walk that has no world sort to join: a Control-only viewport or an
 * unowned scene-tile root. It sorts the Control items only, as `YSortDispatcher` does for a node
 * with a Control root, and gives {@link applyYSortShifts} the same shifts. Pure data: no React, no THREE.
 */

import {
  multiplyTransform2D,
  TRANSFORM2D_IDENTITY,
  type Transform2DColumns,
} from '../../../godot/math/transform2d';
import { accumulateCanvasItemZ } from '../../lighting2d/canvasItemPlacement';
import { packPaintRanges, paintRangeSize, ysortsChildren } from '../../canvasPaintOrder';
import type { ControlTransforms, YSortShift, YSortShifts } from '../../contexts/ControlYSortContext';
import { compareSortY } from '../../ySortOrder';
import type { TscnNode } from '../../../parser/types';
import { controlProps, type SolveNode } from './solveTree';

interface LocalItem {
  node: SolveNode;
  sortY: number;
  z: number;
}

/**
 * The run an item needs. A y-sorted item is its body alone, since its children are items of their
 * own. Any other item holds its whole subtree, or its descendants would draw inside the next run.
 */
function itemRunSize(node: TscnNode): number {
  return paintRangeSize(ysortsChildren(node) ? { ...node, children: [] } : node);
}

/**
 * The runs the y-sort gives each Control item of `tree`. A y-sorted Control merges its y-sorted
 * Control children into one list, whose items sort by z, then by origin y composed down to the sort
 * root, equal ys keeping tree order (`renderer_canvas_cull.cpp:110-160`).
 */
export function localYSortShifts(tree: readonly SolveNode[], transforms: ControlTransforms): YSortShifts {
  const shifts = new Map<string, YSortShift>();

  /** A sort root below a non-sorted item: the outer sort moves the item, and the root with it. */
  interface NestedRoot {
    root: SolveNode;
    owner: LocalItem;
  }

  /** Sorts `root`'s items into its run, which the outer sort has moved by `delta`. */
  const sortUnder = (root: SolveNode, delta: number): void => {
    const items: LocalItem[] = [];
    const nested: NestedRoot[] = [];
    // Z compares as absolute values, so the items start from the root's own z.
    const rootProps = controlProps(root);
    const rootZ = accumulateCanvasItemZ(0, {
      z_index: rootProps.zIndex ?? 0,
      z_as_relative: rootProps.zAsRelative,
    });
    collect(root, TRANSFORM2D_IDENTITY, rootZ, items, nested);
    const sorted = items
      .map((item, order) => ({ item, order }))
      .sort((a, b) => a.item.z - b.item.z || compareSortY(a.item.sortY, b.item.sortY) || a.order - b.order);
    const sizes = sorted.map(({ item }) => itemRunSize(item.node.node));
    const movedRun = { base: root.paintRange.base + delta, size: root.paintRange.size };
    const runs = packPaintRanges(movedRun, sizes, root.paintSequence + delta + 1);
    sorted.forEach(({ item }, i) =>
      shifts.set(item.node.path, { run: runs[i]!, from: item.node.paintRange.base })
    );
    for (const { root: inner, owner } of nested) {
      sortUnder(inner, shifts.get(owner.node.path)!.run.base - owner.node.paintRange.base);
    }
  };

  const collect = (
    parent: SolveNode,
    toRoot: Transform2DColumns,
    parentZ: number,
    out: LocalItem[],
    nested: NestedRoot[]
  ) => {
    for (const child of parent.children) {
      const own = transforms.get(child.path);
      const toSortRoot = own ? multiplyTransform2D(toRoot, own) : toRoot;
      const props = controlProps(child);
      const z = accumulateCanvasItemZ(parentZ, {
        z_index: props.zIndex ?? 0,
        z_as_relative: props.zAsRelative,
      });
      const item = { node: child, sortY: toSortRoot.ty, z };
      out.push(item);
      if (ysortsChildren(child.node)) collect(child, toSortRoot, z, out, nested);
      else findSortRoots(child, (root) => nested.push({ root, owner: item }));
    }
  };

  /** Calls `found` on each sort root in the subtree of `node`, the outermost of a chain only. */
  const findSortRoots = (node: SolveNode, found: (root: SolveNode) => void): void => {
    if (ysortsChildren(node.node)) found(node);
    else node.children.forEach((child) => findSortRoots(child, found));
  };

  tree.forEach((node) => findSortRoots(node, (root) => sortUnder(root, 0)));
  return shifts;
}
