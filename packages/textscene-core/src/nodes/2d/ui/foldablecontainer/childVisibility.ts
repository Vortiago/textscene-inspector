/**
 * The `visible` a FoldableContainer writes onto its children. The parser registration declares it,
 * so every walk reads it before any renderer chunk loads.
 */

import type { ChildVisibilityFn } from '../../../../core/childVisibility';
import type { FoldableContainerProperties } from './types';

/**
 * `c->set_visible(!folded)` in `NOTIFICATION_SORT_CHILDREN` (`foldable_container.cpp:376-386`)
 * writes `visible` on each sortable child, so it overrides the authored flag both ways.
 * Every child gets the same value, so the per-child arguments of {@link ChildVisibilityFn} go unread.
 */
export const foldableContainerChildVisibility: ChildVisibilityFn = (node) =>
  (node.properties as FoldableContainerProperties).folded !== true;
