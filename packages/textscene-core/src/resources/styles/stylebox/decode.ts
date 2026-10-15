/**
 * `StyleBox` decode: a `StyleBoxFlat` or `StyleBoxEmpty` property bag into the
 * `StyleBoxFlatData` the Control painters draw. Pure data: no React, no THREE.
 */

import { clamp } from '../../../godot/math/math';
import type { Vector2 } from '../../../godot/math/vector';
import { boolOr, floatOr, vec2Or } from '../../../parser/valueParsers';
import type { StyleBoxFlatData } from '../../../r3f/controls/native/styleBoxFlat';
import { colorOr } from '../../../utils/colorParser';

// An absent StyleBoxFlat key takes Godot's default (`r3f/controls/native/styleBoxFlat.ts` cites each field).
const DEFAULT_BG_COLOR = { r: 0.6, g: 0.6, b: 0.6, a: 1 }; // style_box_flat.h:38
const DEFAULT_BORDER_COLOR = { r: 0.8, g: 0.8, b: 0.8, a: 1 }; // style_box_flat.h:40
const DEFAULT_SHADOW_COLOR = { r: 0, g: 0, b: 0, a: 0.6 }; // style_box_flat.h:39
const ZERO_VECTOR2: Vector2 = { x: 0, y: 0 }; // `skew`/`shadow_offset` (style_box_flat.h:48,53)
const TRANSPARENT = { r: 0, g: 0, b: 0, a: 0 };

const CONTEXT = 'StyleBoxFlat';

/** `content_margin_<side>`'s `-1` sentinel (`style_box.cpp:143`): "ask the stylebox's own style margin". */
const CONTENT_MARGIN_UNSET = -1;

/** `StyleBoxFlat::set_aa_size`'s clamp range (`style_box_flat.cpp`), applied to every authored `aa_size`. */
const AA_SIZE_MIN = 0.01;
const AA_SIZE_MAX = 10;
/** `StyleBoxFlat::set_corner_detail` (`style_box_flat.cpp:130`): CLAMP(detail, 1, 20). */
const CORNER_DETAIL_MIN = 1;
const CORNER_DETAIL_MAX = 20;

/**
 * `StyleBox::get_margin` (`style_box.cpp:78-86`): the authored `content_margin_<side>`, or, when it
 * is negative (unset), the subclass's `get_style_margin(side)`, which the caller passes as `styleMargin`.
 */
export function contentMarginOr(raw: string | undefined, styleMargin: number, context: string): number {
  const parsed = floatOr(raw, CONTENT_MARGIN_UNSET, context);
  return parsed < 0 ? styleMargin : parsed;
}

/** The base `StyleBox`'s `expand_margin_<side>`, each zero by default. */
export function expandMarginOf(
  data: Record<string, string>,
  context: string
): StyleBoxFlatData['expandMargin'] {
  return {
    left: floatOr(data.expand_margin_left, 0, context),
    top: floatOr(data.expand_margin_top, 0, context),
    right: floatOr(data.expand_margin_right, 0, context),
    bottom: floatOr(data.expand_margin_bottom, 0, context),
  };
}

/**
 * A `StyleBoxLine`/`StyleBoxTexture` wrapper's `StyleBoxFlatData` core. Every
 * field except `contentMargin` is the no-draw neutral `StyleBoxEmpty` uses, so
 * `styleBoxFlatGeometry` emits zero vertices for it.
 */
export function neutralStyleBox(contentMargin: StyleBoxFlatData['contentMargin']): StyleBoxFlatData {
  return {
    bgColor: TRANSPARENT,
    borderColor: TRANSPARENT,
    borderWidth: { left: 0, top: 0, right: 0, bottom: 0 },
    cornerRadius: { topLeft: 0, topRight: 0, bottomRight: 0, bottomLeft: 0 },
    expandMargin: { left: 0, top: 0, right: 0, bottom: 0 },
    contentMargin,
    drawCenter: false,
    borderBlend: false,
    antiAliased: false,
    aaSize: 1,
    cornerDetail: 1,
    skew: ZERO_VECTOR2,
    shadowColor: TRANSPARENT,
    shadowSize: 0,
    shadowOffset: ZERO_VECTOR2,
  };
}

/**
 * A decoded `StyleBoxEmpty`: `StyleBoxEmpty::draw` is empty, and the base
 * `get_style_margin` is 0, so an unset `content_margin_<side>` resolves to 0.
 * Its `expand_margin_*` is a base `StyleBox` property, so it is kept.
 */
function decodeEmpty(data: Record<string, string>): StyleBoxFlatData {
  return {
    ...neutralStyleBox({
      left: contentMarginOr(data.content_margin_left, 0, CONTEXT),
      top: contentMarginOr(data.content_margin_top, 0, CONTEXT),
      right: contentMarginOr(data.content_margin_right, 0, CONTEXT),
      bottom: contentMarginOr(data.content_margin_bottom, 0, CONTEXT),
    }),
    expandMargin: expandMarginOf(data, CONTEXT),
  };
}

/** `null` for a type this slice does not claim, so a caller tells "not ours" from "draws nothing". */
export function decodeStyleBox(type: string, data: Record<string, string>): StyleBoxFlatData | null {
  if (type === 'StyleBoxEmpty') return decodeEmpty(data);
  if (type === 'StyleBoxFlat') return decodeFlat(data);
  return null;
}

function decodeFlat(data: Record<string, string>): StyleBoxFlatData {
  const borderWidth = {
    left: floatOr(data.border_width_left, 0, CONTEXT),
    top: floatOr(data.border_width_top, 0, CONTEXT),
    right: floatOr(data.border_width_right, 0, CONTEXT),
    bottom: floatOr(data.border_width_bottom, 0, CONTEXT),
  };

  return {
    bgColor: colorOr(data.bg_color, DEFAULT_BG_COLOR),
    borderColor: colorOr(data.border_color, DEFAULT_BORDER_COLOR),
    borderWidth,
    cornerRadius: {
      topLeft: floatOr(data.corner_radius_top_left, 0, CONTEXT),
      topRight: floatOr(data.corner_radius_top_right, 0, CONTEXT),
      bottomRight: floatOr(data.corner_radius_bottom_right, 0, CONTEXT),
      bottomLeft: floatOr(data.corner_radius_bottom_left, 0, CONTEXT),
    },
    expandMargin: expandMarginOf(data, CONTEXT),
    // `StyleBoxFlat::get_style_margin` returns `border_width[side]` (`style_box_flat.cpp`).
    contentMargin: {
      left: contentMarginOr(data.content_margin_left, borderWidth.left, CONTEXT),
      top: contentMarginOr(data.content_margin_top, borderWidth.top, CONTEXT),
      right: contentMarginOr(data.content_margin_right, borderWidth.right, CONTEXT),
      bottom: contentMarginOr(data.content_margin_bottom, borderWidth.bottom, CONTEXT),
    },
    drawCenter: boolOr(data.draw_center, true, CONTEXT),
    borderBlend: boolOr(data.border_blend, false, CONTEXT),
    // Scene-file keys, not the C++ member names: `_bind_methods` exports
    // `set_anti_aliased`/`set_aa_size` as `anti_aliasing`/`anti_aliasing_size`.
    antiAliased: boolOr(data.anti_aliasing, true, CONTEXT),
    aaSize: clamp(floatOr(data.anti_aliasing_size, 1, CONTEXT), AA_SIZE_MIN, AA_SIZE_MAX),
    cornerDetail: Math.round(
      clamp(floatOr(data.corner_detail, 8, CONTEXT), CORNER_DETAIL_MIN, CORNER_DETAIL_MAX)
    ),
    skew: vec2Or(data.skew, ZERO_VECTOR2, `${CONTEXT} skew`),
    shadowColor: colorOr(data.shadow_color, DEFAULT_SHADOW_COLOR),
    // `set_shadow_size` takes an int and the property is INT-typed
    // (`style_box_flat.cpp:727`), so a fractional authored value truncates
    // rather than growing the ring by a fraction.
    shadowSize: Math.trunc(floatOr(data.shadow_size, 0, CONTEXT)),
    shadowOffset: vec2Or(data.shadow_offset, ZERO_VECTOR2, `${CONTEXT} shadow_offset`),
  };
}
