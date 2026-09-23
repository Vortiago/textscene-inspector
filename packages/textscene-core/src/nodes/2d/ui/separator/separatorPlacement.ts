/**
 * `Separator::_notification(NOTIFICATION_DRAW)`'s placement rect (`scene/gui/separator.cpp:47-56`):
 * the sub-rect Separator hands `separator_style`, centred on the cross axis by
 * `StyleBox::get_minimum_size` (`contentMarginSize`). It reads only margins, so it serves every kind.
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */

import { contentMarginSize, type StyleBoxFlatData } from '../../../../r3f/controls/native/styleBoxFlat';
import type { Rect2 } from '../../../../r3f/controls/native/rect';
import type { SeparatorOrientation } from './styleBoxLine';

/** C++ `int / 2` truncates toward zero; `Math.floor` would not for a negative dividend. */
function truncHalf(n: number): number {
  return Math.trunc(n / 2);
}

/** `separator.cpp:48-56`: `Size2i size`/`Size2i ssize` are both truncated before the centring divide. */
export function separatorPlacementRect(
  orientation: SeparatorOrientation,
  rect: Rect2,
  box: StyleBoxFlatData
): Rect2 {
  const size = { x: Math.trunc(rect.w), y: Math.trunc(rect.h) };
  // `StyleBox::get_minimum_size` (style_box.cpp:35-36) sums the four resolved
  // margins as floats first, truncating only the sum.
  const margin = contentMarginSize(box);
  const ssize = { x: Math.trunc(margin.x), y: Math.trunc(margin.y) };

  return orientation === 'vertical'
    ? { x: truncHalf(size.x - ssize.x), y: 0, w: ssize.x, h: size.y }
    : { x: 0, y: truncHalf(size.y - ssize.y), w: size.x, h: ssize.y };
}
