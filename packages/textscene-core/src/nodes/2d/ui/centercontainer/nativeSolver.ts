/**
 * CenterContainer's native (WebGL canvas) layout solver — a port of
 * `CenterContainer::get_minimum_size` and its `NOTIFICATION_SORT_CHILDREN`
 * handler (`scene/gui/center_container.cpp`), plus the shared
 * `Container::fit_child_in_rect` (`scene/gui/container.cpp:95-128`) that
 * handler calls. CenterContainer draws nothing itself; `NativeComponent.tsx`
 * renders nothing and the walker paints children as siblings.
 *
 * The one property this container adds beyond Control — `use_top_left`
 * (`center_container.h:38`) — changes BOTH halves: `get_minimum_size` returns
 * `(0, 0)` instead of the children's aggregate, and `_notification` centres
 * each child on the container's top-left CORNER (so the child straddles the
 * origin, partly off to the negative side) instead of the container's own
 * centre.
 *
 * `fit_child_in_rect`'s FILL branch is a genuine no-op here, not merely
 * cross-axis: `_notification` hands it `Rect2(ofs, minsize)` — a rect whose
 * SIZE already equals the child's own combined minimum size on BOTH axes
 * (`center_container.cpp:83-84`) — so whether or not the child's size flags
 * include `SIZE_FILL`, `fit_child_in_rect`'s `r.size = p_rect.size` either
 * way lands on the same `minsize`. A child can never grow to fill a
 * CenterContainer by setting FILL; it always ends up at its own minimum,
 * centred.
 *
 * RTL is out of scope (no `layout_direction` is modelled anywhere in this
 * solver — see `controlRectSolver.ts`).
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */

import type { Rect2, Vec2 } from '../../../../r3f/controls/native/rect';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import type { ContainerLayoutFn, MinimumSizeFn } from '../../../../r3f/controls/native/solverRegistry';
import type { CenterContainerProperties } from './types';

// Control::SizeFlags (control.h:78-85) — read here only to confirm
// `fit_child_in_rect`'s branch is a no-op (see module doc); the flags never
// change this container's actual result.
const SIZE_FILL = 1;
const SIZE_SHRINK_CENTER = 4;
const SIZE_SHRINK_END = 8;
const DEFAULT_SIZE_FLAGS = SIZE_FILL;

function props(n: SolveNode): CenterContainerProperties {
  return n.node.properties as CenterContainerProperties;
}

/** See `margincontainer/nativeSolver.ts`'s identical helper for the caveat about ancestor visibility. */
function isSortable(child: SolveNode): boolean {
  return props(child).visible !== false;
}

/** `Container::fit_child_in_rect` (`container.cpp:95-128`), RTL omitted (see module doc). */
function fitChildInRect(rect: Rect2, minSize: Vec2, hFlags: number, vFlags: number): Rect2 {
  let { x, y, w, h } = rect;

  if ((hFlags & SIZE_FILL) === 0) {
    const fullW = w;
    w = minSize.x;
    if ((hFlags & SIZE_SHRINK_END) !== 0) x += fullW - minSize.x;
    else if ((hFlags & SIZE_SHRINK_CENTER) !== 0) x += Math.floor((fullW - minSize.x) / 2);
  }

  if ((vFlags & SIZE_FILL) === 0) {
    const fullH = h;
    h = minSize.y;
    if ((vFlags & SIZE_SHRINK_END) !== 0) y += fullH - minSize.y;
    else if ((vFlags & SIZE_SHRINK_CENTER) !== 0) y += Math.floor((fullH - minSize.y) / 2);
  }

  return { x, y, w, h };
}

/**
 * `CenterContainer::get_minimum_size` (`center_container.cpp:33-48`):
 * `(0, 0)` when `use_top_left`, else the componentwise max of every visible
 * child's own combined minimum size (`Size2::max`).
 */
export const centerContainerMinimumSize: MinimumSizeFn = (n, ctx) => {
  if (props(n).useTopLeft === true) return { x: 0, y: 0 };

  let maxW = 0;
  let maxH = 0;
  for (const child of n.children) {
    if (!isSortable(child)) continue;
    const s = ctx.combinedMinimumSize(child);
    if (s.x > maxW) maxW = s.x;
    if (s.y > maxH) maxH = s.y;
  }
  return { x: maxW, y: maxH };
};

/**
 * `CenterContainer::_notification`'s `NOTIFICATION_SORT_CHILDREN`
 * (`center_container.cpp:73-88`): each visible child is centred
 * INDEPENDENTLY on ITS OWN combined minimum size — there is no shared
 * distribution the way a box container splits space between siblings, so two
 * children with different minimum sizes end up at two different offsets,
 * both centred on the container's own rect (or its top-left corner, under
 * `use_top_left`).
 *
 * `size` below is `contentRect.w`/`.h` ONLY — like `computeAnchoredRect`,
 * `contentRect.x`/`.y` are this node's OWN parent-relative position and must
 * not leak into a child's rect, which is relative to THIS node's top-left.
 */
export const centerContainerLayout: ContainerLayoutFn = (n, children, contentRect, _ctx) => {
  const useTopLeft = props(n).useTopLeft === true;

  const out = new Map<string, Rect2>();
  for (const { node: child, minSize } of children) {
    if (!isSortable(child)) continue;
    const ofsX = useTopLeft ? Math.floor(-minSize.x * 0.5) : Math.floor((contentRect.w - minSize.x) / 2);
    const ofsY = useTopLeft ? Math.floor(-minSize.y * 0.5) : Math.floor((contentRect.h - minSize.y) / 2);

    const cp = child.node.properties as CenterContainerProperties;
    const hFlags = cp.sizeFlagsHorizontal ?? DEFAULT_SIZE_FLAGS;
    const vFlags = cp.sizeFlagsVertical ?? DEFAULT_SIZE_FLAGS;
    // `Rect2(ofs, minsize)` — the rect fit_child_in_rect receives already IS
    // the child's own minimum size (center_container.cpp:84), which is what
    // makes the FILL branch a no-op (see module doc).
    out.set(child.path, fitChildInRect({ x: ofsX, y: ofsY, w: minSize.x, h: minSize.y }, minSize, hFlags, vFlags));
  }
  return out;
};
