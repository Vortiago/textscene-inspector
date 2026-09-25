/**
 * `StyleBox` decode: an inline `[sub_resource]` or a `[resource]` body into typed
 * data. The editor omits a property at its default, so each default is a member
 * initialiser in `scene/resources/style_box_flat.h`, cited by line as `h:<n>`.
 */

import { boolOr, floatOr, intOr, vec2Or } from '../../../parser/valueParsers';
import { colorOr } from '../../../utils/colorParser';
import type { StyleBoxData, StyleBoxFlatData, StyleBoxSides } from './types';

const BG_DEFAULT = { r: 0.6, g: 0.6, b: 0.6, a: 1 }; // h:38
const BORDER_DEFAULT = { r: 0.8, g: 0.8, b: 0.8, a: 1 }; // h:40
const SHADOW_DEFAULT = { r: 0, g: 0, b: 0, a: 0.6 }; // h:39

/**
 * `null` for a type this slice does not claim (`StyleBoxTexture`, `StyleBoxLine`,
 * a non-StyleBox), so callers can tell "not ours" from "ours, paints nothing".
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
  const borderWidth = sides(properties, 'border_width'); // 0 (h:42)

  return {
    kind: 'flat',
    bgColor: colorOr(properties.bg_color, BG_DEFAULT),
    drawCenter: boolOr(properties.draw_center, true, 'StyleBoxFlat.draw_center'), // h:46
    // 0 (h:44)
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
    // `int shadow_size` (h:52): read as an int, so a fraction truncates as Godot's
    // Variant conversion does.
    shadowSize: intOr(properties.shadow_size, 0, 'StyleBoxFlat.shadow_size'),
    shadowColor: colorOr(properties.shadow_color, SHADOW_DEFAULT),
    shadowOffset: vec2Or(properties.shadow_offset, { x: 0, y: 0 }, 'StyleBoxFlat.shadow_offset'), // h:53
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
 * `StyleBox::get_margin` (style_box.cpp:78-86): a negative content margin (the
 * −1 default, style_box.cpp:141-145) reports `get_style_margin`, which for a
 * flat box is the side's border width (style_box_flat.cpp:37-40).
 */
function contentMargin(value: string | undefined, borderWidth: number, side: string): number {
  const declared = floatOr(value, -1, `StyleBoxFlat.content_margin_${side}`);
  return declared >= 0 ? declared : borderWidth;
}
