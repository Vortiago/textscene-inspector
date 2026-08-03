/**
 * `StyleBox` decode — a property bag (an inline `[sub_resource]` theme override
 * or a ParsedResource `[resource]` body) into typed data. Godot's defaults come
 * from the member initialisers in `scene/resources/style_box_flat.h`, since the
 * editor omits every property still at its default from the saved scene:
 *
 *   bg_color Color(0.6, 0.6, 0.6) (h:38) · shadow_color Color(0, 0, 0, 0.6)
 *   (h:39) · border_color Color(0.8, 0.8, 0.8) (h:40) · border_width 0 (h:42) ·
 *   corner_radius 0 (h:44) · draw_center true (h:46) · shadow_size 0 (h:52) ·
 *   shadow_offset (0, 0) (h:53) · content_margin −1 (style_box.cpp:141-145).
 */

import { boolOr, floatOr, intOr, vec2Or } from '../../../parser/valueParsers';
import { colorOr } from '../../../utils/colorParser';
import type { StyleBoxData, StyleBoxFlatData, StyleBoxSides } from './types';

const BG_DEFAULT = { r: 0.6, g: 0.6, b: 0.6, a: 1 };
const BORDER_DEFAULT = { r: 0.8, g: 0.8, b: 0.8, a: 1 };
const SHADOW_DEFAULT = { r: 0, g: 0, b: 0, a: 0.6 };

/**
 * Decode one StyleBox. Returns `null` for a type this slice does not claim
 * (`StyleBoxTexture`, `StyleBoxLine`, or a reference that resolved to something
 * that is not a StyleBox at all) so callers can tell "not ours" from
 * "ours, and it paints nothing".
 */
export function decodeStyleBox(
  type: string,
  properties: Record<string, string>
): StyleBoxData | null {
  if (type === 'StyleBoxEmpty') return { kind: 'empty' };
  if (type === 'StyleBoxFlat') return decodeFlat(properties);
  return null;
}

function decodeFlat(properties: Record<string, string>): StyleBoxFlatData {
  const borderWidth = sides(properties, 'border_width');

  return {
    kind: 'flat',
    bgColor: colorOr(properties.bg_color, BG_DEFAULT),
    drawCenter: boolOr(properties.draw_center, true, 'StyleBoxFlat.draw_center'),
    cornerRadius: {
      topLeft: radius(properties.corner_radius_top_left, 'corner_radius_top_left'),
      topRight: radius(properties.corner_radius_top_right, 'corner_radius_top_right'),
      bottomRight: radius(properties.corner_radius_bottom_right, 'corner_radius_bottom_right'),
      bottomLeft: radius(properties.corner_radius_bottom_left, 'corner_radius_bottom_left'),
    },
    borderWidth,
    borderColor: colorOr(properties.border_color, BORDER_DEFAULT),
    contentMargin: {
      left: contentMargin(properties.content_margin_left, borderWidth.left, 'left'),
      top: contentMargin(properties.content_margin_top, borderWidth.top, 'top'),
      right: contentMargin(properties.content_margin_right, borderWidth.right, 'right'),
      bottom: contentMargin(properties.content_margin_bottom, borderWidth.bottom, 'bottom'),
    },
    // `int shadow_size` (h:52) — read as an int so a hand-written fraction
    // truncates the way Godot's Variant conversion does.
    shadowSize: intOr(properties.shadow_size, 0, 'StyleBoxFlat.shadow_size'),
    shadowColor: colorOr(properties.shadow_color, SHADOW_DEFAULT),
    shadowOffset: vec2Or(properties.shadow_offset, { x: 0, y: 0 }, 'StyleBoxFlat.shadow_offset'),
  };
}

function radius(value: string | undefined, key: string): number {
  return floatOr(value, 0, `StyleBoxFlat.${key}`);
}

function sides(properties: Record<string, string>, key: string): StyleBoxSides {
  return {
    left: floatOr(properties[`${key}_left`], 0, `StyleBoxFlat.${key}_left`),
    top: floatOr(properties[`${key}_top`], 0, `StyleBoxFlat.${key}_top`),
    right: floatOr(properties[`${key}_right`], 0, `StyleBoxFlat.${key}_right`),
    bottom: floatOr(properties[`${key}_bottom`], 0, `StyleBoxFlat.${key}_bottom`),
  };
}

/**
 * `StyleBox::get_margin` (style_box.cpp:78-86): a negative content margin — the
 * −1 default — reports `get_style_margin`, which for a flat box is the side's
 * border width (style_box_flat.cpp:37-40).
 */
function contentMargin(value: string | undefined, borderWidth: number, side: string): number {
  const declared = floatOr(value, -1, `StyleBoxFlat.content_margin_${side}`);
  return declared >= 0 ? declared : borderWidth;
}
