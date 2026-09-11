/**
 * `StyleBoxLine::draw` (`scene/resources/style_box_line.cpp:86-100`) — the
 * rect it actually paints, given ANY caller's rect (`Separator` is the one
 * caller today, `nodes/2d/ui/separator/Component.tsx`, composing this with
 * its own placement rect — see that module's own doc — but the transform
 * below is `StyleBoxLine::draw`'s own, independent of who calls it).
 *
 * `Rect2i r = p_rect` truncates toward zero first (C++'s implicit
 * `Rect2`→`Rect2i` conversion), so `Math.trunc` is used throughout, never
 * `Math.floor` — the two disagree the moment a component goes negative (a
 * `grow_begin` larger than the rect's own offset).
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */

import type { Rect2 } from './rect';
import type { StyleBoxLineData } from './styleBoxLine';

/**
 * `style_box_line.cpp:88-98`. `box.vertical` is the RESOURCE's own field —
 * independent of any orientation a caller like `Separator` carries, since
 * `StyleBoxLine::draw` reads only its own member.
 */
export function styleBoxLineDrawRect(rect: Rect2, box: StyleBoxLineData): Rect2 {
  const r = { x: Math.trunc(rect.x), y: Math.trunc(rect.y), w: Math.trunc(rect.w), h: Math.trunc(rect.h) };
  if (box.vertical) {
    return {
      x: r.x,
      y: Math.trunc(r.y - box.growBegin),
      w: box.thickness,
      h: Math.trunc(r.h + box.growBegin + box.growEnd),
    };
  }
  return {
    x: Math.trunc(r.x - box.growBegin),
    y: r.y,
    w: Math.trunc(r.w + box.growBegin + box.growEnd),
    h: box.thickness,
  };
}
