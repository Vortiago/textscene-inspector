/**
 * `StyleBoxLine::draw` (`scene/resources/style_box_line.cpp:86-100`): the rect it
 * paints for a caller's rect. `Rect2i r = p_rect` truncates toward zero, so this
 * uses `Math.trunc`, never `Math.floor`, which differs for a negative component.
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */

import type { Rect2 } from './rect';
import type { StyleBoxLineData } from './styleBoxLine';

/**
 * `style_box_line.cpp:88-98`. `box.vertical` is the resource's own field, not a
 * caller's orientation: `StyleBoxLine::draw` reads only its own member.
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
