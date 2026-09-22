/**
 * `StyleBoxFlatData` — a resolved `StyleBoxFlat`, numbers only. The shape
 * `native/parseStyleBox.ts` produces and `native/styleBoxFlatGeometry.ts`
 * consumes; `native/solveTree.ts` also type-imports it because a container's
 * minimum-size math (e.g. PanelContainer's content margins) needs a
 * StyleBox's numbers before any geometry is built.
 *
 * Pure data, no React, no THREE.
 *
 * Field names and defaults transcribed from
 * `scene/resources/style_box_flat.h`/`.cpp` (Godot 4.6.3):
 *  - `bg_color` default `Color(0.6, 0.6, 0.6)` (`style_box_flat.h:38`).
 *  - `border_color` default `Color(0.8, 0.8, 0.8)` (`:40`).
 *  - `border_width`, `corner_radius`, `expand_margin` are `real_t[4]`, all
 *    zero by default (`:42-44`), indexed by `Side` (LEFT/TOP/RIGHT/BOTTOM) for
 *    the first two and `Corner` (TOP_LEFT/TOP_RIGHT/BOTTOM_RIGHT/BOTTOM_LEFT)
 *    for radius.
 *  - `content_margin` lives on the `StyleBox` base (`style_box.h:43`), default
 *    `-1` per side meaning "ask `get_style_margin`", which `StyleBoxFlat`
 *    overrides to fall back to the matching `border_width`
 *    (`style_box_flat.cpp::get_style_margin`, `style_box.cpp::get_margin`).
 *    This struct stores the EFFECTIVE margin (post fallback), not the raw
 *    `-1` sentinel, so every consumer reads one number per side without
 *    repeating the fallback rule.
 *  - `draw_center` default `true`, `blend_border` (`border_blend` in the
 *    scene-file property name) default `false` (`style_box_flat.h:46-47`).
 *  - `anti_aliased` default `true`, `aa_size` default `1`, clamped to
 *    `[0.01, 10]` by `StyleBoxFlat::set_aa_size` (`style_box_flat.h:49,54`,
 *    `style_box_flat.cpp::set_aa_size`).
 */

import type { ControlColor } from '../../../nodes/2d/ui/control/types';
import type { Vec2 } from './rect';

export interface StyleBoxFlatData {
  bgColor: ControlColor;
  borderColor: ControlColor;
  borderWidth: { left: number; top: number; right: number; bottom: number };
  cornerRadius: { topLeft: number; topRight: number; bottomRight: number; bottomLeft: number };
  expandMargin: { left: number; top: number; right: number; bottom: number };
  contentMargin: { left: number; top: number; right: number; bottom: number };
  drawCenter: boolean;
  borderBlend: boolean;
  antiAliased: boolean;
  aaSize: number;
  /**
   * How many steps each rounded corner's quarter arc is swept in
   * (`style_box_flat.h:51`, default 8, setter-clamped to 1..20). Only
   * meaningful when a radius is authored: the tessellator collapses every
   * corner to a single step otherwise (`style_box_flat.cpp:316`).
   */
  cornerDetail: number;
  /**
   * `skew` (`style_box_flat.h:48`) — a shear applied to every vertex about the
   * style rect's own centre, so the box leans without moving. Non-zero skew
   * also turns anti-aliasing on by itself (`style_box_flat.cpp:471`), since a
   * sheared edge is diagonal even when every corner is sharp.
   */
  skew: Vec2;
  /** `shadow_color` (`style_box_flat.h:39`, default `Color(0, 0, 0, 0.6)`) — the drop shadow's own colour at its inner edge, fading to alpha 0 outward. */
  shadowColor: ControlColor;
  /** `shadow_size` (`style_box_flat.h:52`) — how far the shadow grows past the style rect. 0 (the default) draws no shadow at all, whatever `shadow_color` says. */
  shadowSize: number;
  /** `shadow_offset` (`style_box_flat.h:53`) — displaces the whole shadow, so it can sit under one side of the box. */
  shadowOffset: Vec2;
}

type Sides = { left: number; top: number; right: number; bottom: number };

const NO_SIDES: Sides = { left: 0, top: 0, right: 0, bottom: 0 };

/** Every field `make_flat_stylebox` (`default_theme.cpp:57-70`) leaves at `StyleBoxFlat`'s own default. */
export interface FlatStyleBoxOptions {
  contentMargin?: Sides;
  cornerRadius?: number | StyleBoxFlatData['cornerRadius'];
  borderWidth?: number | Sides;
  borderColor?: ControlColor;
  expandMargin?: Sides;
}

/**
 * `make_flat_stylebox` (`default_theme.cpp:57-70`), restricted to what
 * `StyleBoxFlatData` models. Every option left out keeps `StyleBoxFlat`'s own
 * constructed default, which is what the theme builder relies on: it assigns
 * only a colour, the four margins and a corner radius, and never touches
 * `border_blend`, `anti_aliased`, `aa_size`, `corner_detail` or the shadow.
 */
export function flatStyleBox(
  bgColor: ControlColor,
  options: FlatStyleBoxOptions = {}
): StyleBoxFlatData {
  const { contentMargin = NO_SIDES, cornerRadius = 0, borderWidth = 0 } = options;
  const corners =
    typeof cornerRadius === 'number'
      ? {
          topLeft: cornerRadius,
          topRight: cornerRadius,
          bottomRight: cornerRadius,
          bottomLeft: cornerRadius,
        }
      : cornerRadius;
  return {
    bgColor,
    borderColor: options.borderColor ?? { r: 0.8, g: 0.8, b: 0.8, a: 1 },
    borderWidth:
      typeof borderWidth === 'number'
        ? { left: borderWidth, top: borderWidth, right: borderWidth, bottom: borderWidth }
        : borderWidth,
    cornerRadius: corners,
    expandMargin: options.expandMargin ?? NO_SIDES,
    contentMargin,
    drawCenter: true,
    borderBlend: false,
    antiAliased: true,
    aaSize: 1,
    cornerDetail: 8,
    skew: { x: 0, y: 0 },
    shadowColor: { r: 0, g: 0, b: 0, a: 0.6 },
    shadowSize: 0,
    shadowOffset: { x: 0, y: 0 },
  };
}

/**
 * The total space a StyleBox's content margins take from a rect — the amount
 * every `get_minimum_size` adds on top of its content, and the amount every
 * content rect is inset by (`StyleBox::get_minimum_size`, which sums the same
 * two pairs).
 *
 * The margins are already effective values: `parseStyleBox` resolves the `-1`
 * sentinel to the matching border width before it ever reaches this struct.
 */
export function contentMarginSize(box: StyleBoxFlatData): Vec2 {
  return {
    x: box.contentMargin.left + box.contentMargin.right,
    y: box.contentMargin.top + box.contentMargin.bottom,
  };
}
