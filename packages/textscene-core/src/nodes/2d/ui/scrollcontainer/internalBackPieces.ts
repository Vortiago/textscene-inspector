/**
 * The `INTERNAL_MODE_BACK` children a ScrollContainer adds in its constructor, which its painter
 * draws itself: two scroll hints, then the two bars (`scroll_container.cpp:905-924`). A y-sort
 * collects each visible one as an entry of its own, at its own origin.
 */

import type { InternalBackPiece, InternalBackPiecesFn } from '../../../../r3f/controls/native/solverRegistry';
import type { Rect2 } from '../../../../godot/math/rect2';
import { scrollContainerLayoutChannel } from './nativeSolver';

/** `h_scroll->set_name("_h_scroll")` (`scroll_container.cpp:917`). */
export const H_SCROLL = '_h_scroll';
/** `v_scroll->set_name("_v_scroll")` (`scroll_container.cpp:922`). */
export const V_SCROLL = '_v_scroll';
/** The hints get no name in Godot, so these are the members that hold them (`scroll_container.cpp:905,911`). */
export const SCROLL_HINT_TOP_LEFT = 'scroll_hint_top_left';
export const SCROLL_HINT_BOTTOM_RIGHT = 'scroll_hint_bottom_right';

export const scrollContainerInternalBackPieces: InternalBackPiecesFn = (solved) => {
  const layout = scrollContainerLayoutChannel.open(solved.meta);
  if (!layout) return [];
  const pieces: InternalBackPiece[] = [];
  const add = (name: string, rect: Rect2 | null) => {
    if (rect) pieces.push({ name, origin: { x: rect.x, y: rect.y } });
  };
  add(SCROLL_HINT_TOP_LEFT, layout.hints.topLeft?.rect ?? null);
  add(SCROLL_HINT_BOTTOM_RIGHT, layout.hints.bottomRight?.rect ?? null);
  add(H_SCROLL, layout.horizontal.visible ? layout.horizontal.rect : null);
  add(V_SCROLL, layout.vertical.visible ? layout.vertical.rect : null);
  return pieces;
};
