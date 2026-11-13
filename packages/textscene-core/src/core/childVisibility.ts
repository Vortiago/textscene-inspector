/**
 * The `visible` a container writes onto its children while it sorts them, a fact of the node type
 * that every walk of the scene tree reads. The node registry holds it, so it is there before any
 * renderer chunk loads.
 */

import type { TscnNode } from '../parser/types';

/**
 * The `visible` a container writes onto one direct sortable Control child
 * while sorting. `undefined` leaves the authored flag alone. `index` and
 * `count` number the sortable children only (`tab_container.cpp:469-481`).
 */
// Per child: `FoldableContainer` writes `c->set_visible(!folded)` to every child
// (`scene/gui/foldable_container.cpp:376-386`), while `TabContainer` shows only the
// current page (`scene/gui/tab_container.cpp:377-399`, and the same split at `:290-293`).
// A promoted or `top_level` Control fails the sortable cast (`container.cpp:143-146`).
export type ChildVisibilityFn = (
  container: TscnNode,
  child: TscnNode,
  index: number,
  count: number
) => boolean | undefined;
