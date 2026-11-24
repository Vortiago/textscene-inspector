/**
 * The `visible` a container writes onto its children while it sorts them, a fact of the node type
 * that every walk of the scene tree reads. The node registry holds it, so it is there before any
 * renderer chunk loads.
 */

import type { TscnNode } from '../parser/types';
import type { VariantValue } from '../godot/variant/variantValue';

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

/** The properties a container's getter resolves from its sortable children, as a TabContainer's page. */
export type SortedPropertiesFn = (
  container: TscnNode,
  sortableCount: number
) => Readonly<Record<string, VariantValue>>;

/** A property the container writes on itself, with the value it takes. */
export type ContainerWrite = readonly [property: string, value: VariantValue];

/** The writes a container makes on itself when a child's `visible` is set; with none, its sort undoes it. */
export type ChildVisibilityWriteFn = (
  container: TscnNode,
  index: number,
  count: number,
  visible: boolean
) => readonly ContainerWrite[];
