/**
 * The `visible` a container writes onto its children while it sorts them: a TabContainer shows only
 * its current page, and a folded FoldableContainer hides every child. The canvas item pass reads it,
 * and the Control walk reads the pass, so a hidden page hides its subtree for both.
 */

import type { TscnNode } from '../../parser/types';
import type { LiveStep, LiveTree } from '../liveSceneTree';
import { nodeRegistry } from '../../core/NodeRegistry';
import { TWO_D_UI_TYPES } from '../controls/has2DUIContent';
import { isTopLevelItem } from '../canvasPaintOrder';
import { isCanvasLayerType } from '../canvasItemClass';

/** A node that writes no child's `visible`. */
export const NOTHING_WRITTEN: ReadonlyMap<TscnNode, boolean> = new Map();

/**
 * The `visible` the node of `step` writes onto each of its sortable children, keyed by the child as
 * its group holds it. Empty for a node that writes none. The container numbers them in one
 * `get_child(i)` loop (`tab_container.cpp:469-481`), so the count spans every group below it.
 */
export function writtenChildVisibility(tree: LiveTree, step: LiveStep): ReadonlyMap<TscnNode, boolean> {
  const write = nodeRegistry.childVisibility(step.node.type);
  if (!write) return NOTHING_WRITTEN;
  const sortable = sortableChildren(tree, step);
  const written = new Map<TscnNode, boolean>();
  for (const [index, { raw, live }] of sortable.entries()) {
    const visible = write(step.node, live, index, sortable.length);
    if (visible !== undefined) written.set(raw, visible);
  }
  return written;
}

/** A sortable child whose `visible` its container writes, with its place among the sortable children. */
export interface WrittenSlot {
  readonly visible: boolean;
  readonly index: number;
  readonly count: number;
}

/** The slot of `raw` below the node of `step`, or null where the node writes no `visible` on it. */
export function writtenSlotOf(tree: LiveTree, step: LiveStep, raw: TscnNode): WrittenSlot | null {
  const write = nodeRegistry.childVisibility(step.node.type);
  if (!write) return null;
  const sortable = sortableChildren(tree, step);
  const index = sortable.findIndex((child) => child.raw === raw);
  if (index < 0) return null;
  const visible = write(step.node, sortable[index]!.live, index, sortable.length);
  return visible === undefined ? null : { visible, index, count: sortable.length };
}

/** The count of children the node of `step` sorts, as a TabContainer counts its pages. */
export function sortableChildCount(tree: LiveTree, step: LiveStep): number {
  return sortableChildren(tree, step).length;
}

function sortableChildren(tree: LiveTree, step: LiveStep): { raw: TscnNode; live: TscnNode }[] {
  return step.groups.flatMap((group) =>
    group.children.flatMap((raw) => {
      const live = tree.stepOf(raw, group.scope).node;
      return isSortableChild(live) ? [{ raw, live }] : [];
    })
  );
}

/**
 * Whether a container's `set_visible` write reaches this direct child:
 * `Container::as_sortable_control(get_child(i), IGNORE)` casts to `Control` and
 * rejects `top_level` first (`container.cpp:143-146`). `CanvasLayer`, in
 * `TWO_D_UI_TYPES`, is no Control.
 */
function isSortableChild(live: TscnNode): boolean {
  return TWO_D_UI_TYPES.has(live.type) && !isTopLevelItem(live) && !isCanvasLayerType(live.type);
}
