/**
 * Where an embedder draws a window's title and close icon, from the window's top-left, as
 * `Viewport::_sub_window_update` places them (`scene/main/viewport.cpp:342-401`). Every input is the
 * window's own theme item, so the painter and its tests read one formula.
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */

import { halfOfInt } from '../../../godot/scene/window';
import { AutowrapMode, TextDirection } from '../../../godot/text/textServerEnums';
import type { FontMetrics } from '../../../r3f/controls/native/text/fontMetrics';
import { shapeText, type TextLayoutResult } from '../../../r3f/controls/native/text/textLayout';
import type { Vector2 } from '../../../godot/math/vector';

/** The width a title may take: what the border's margins and the close offset leave (`:363`). */
export function titleSpace(
  width: number,
  { borderMinimumWidth, closeHOffset }: { borderMinimumWidth: number; closeHOffset: number }
): number {
  return Math.max(0, width - borderMinimumWidth - closeHOffset);
}

/**
 * The top-left of the title line: centred over the window, and centred in the `title_height` band
 * above it (`:368-369`). Both halves land in an `int`, which truncates toward zero.
 */
export function titleOrigin(width: number, titleHeight: number, textSize: Vector2): Vector2 {
  return { x: halfOfInt(width - textSize.x), y: halfOfInt(-titleHeight - textSize.y) };
}

/** The top-left of the close icon, hung from the window's top-right corner (`:382-384`). */
export function closeIconOrigin(
  width: number,
  { closeHOffset, closeVOffset }: { closeHOffset: number; closeVOffset: number }
): Vector2 {
  return { x: width - closeHOffset, y: -closeVOffset };
}

/** What the title shapes with, beyond its text. */
interface TitleShapeOptions {
  fontSizePx: number;
  fontMetrics: FontMetrics;
  /** The window's `is_layout_rtl()`, which sets the line's direction (`viewport.cpp:375`). */
  isRtl: boolean;
}

/**
 * The title as one `TextLine` (`viewport.cpp:374`): no wrap and no mandatory break, so a newline
 * stays inside the line at zero width.
 */
export function shapeTitle(
  title: string,
  { fontSizePx, fontMetrics, isRtl }: TitleShapeOptions
): TextLayoutResult {
  return shapeText(title, {
    direction: isRtl ? TextDirection.TEXT_DIRECTION_RTL : TextDirection.TEXT_DIRECTION_LTR,
    fontSizePx,
    boxWidthPx: 0,
    autowrapMode: AutowrapMode.AUTOWRAP_OFF,
    lineSpacingPx: 0,
    fontMetrics,
    breakMandatory: false,
  });
}
