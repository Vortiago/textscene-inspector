/**
 * `StyleBoxFlatData`: a resolved `StyleBoxFlat`, numbers only, with field names
 * and defaults from `scene/resources/style_box_flat.h`/`.cpp` (Godot 4.6.3).
 * `native/parseStyleBox.ts` produces it. Pure data: no React, no THREE.
 */

import type { ControlColor } from '../../../nodes/2d/ui/control/types';
import type { Vec2 } from './rect';

export interface StyleBoxFlatData {
  /** `bg_color`, default `Color(0.6, 0.6, 0.6)` (`style_box_flat.h:38`). */
  bgColor: ControlColor;
  /** `border_color`, default `Color(0.8, 0.8, 0.8)` (`:40`). */
  borderColor: ControlColor;
  /** `real_t[4]` by `Side`, zero by default (`:42-44`), like `cornerRadius` and `expandMargin`. */
  borderWidth: { left: number; top: number; right: number; bottom: number };
  /** Indexed by `Corner`. */
  cornerRadius: { topLeft: number; topRight: number; bottomRight: number; bottomLeft: number };
  expandMargin: { left: number; top: number; right: number; bottom: number };
  /**
   * The effective margin, not the raw `-1` sentinel of `content_margin` (`style_box.h:43`):
   * unset falls back to the matching `border_width` (`style_box_flat.cpp::get_style_margin`,
   * `style_box.cpp::get_margin`), so a consumer reads one number per side.
   */
  contentMargin: { left: number; top: number; right: number; bottom: number };
  /** Default `true` (`style_box_flat.h:46-47`). */
  drawCenter: boolean;
  /** `blend_border`, scene-file key `border_blend`, default `false`. */
  borderBlend: boolean;
  /** Default `true` (`style_box_flat.h:49,54`). */
  antiAliased: boolean;
  /** Default `1`, clamped to `[0.01, 10]` by `style_box_flat.cpp::set_aa_size`. */
  aaSize: number;
  /**
   * How many steps each rounded corner's quarter arc is swept in
   * (`style_box_flat.h:51`, default 8, setter-clamped to 1..20). Without a
   * radius the tessellator uses a single step (`style_box_flat.cpp:316`).
   */
  cornerDetail: number;
  /**
   * `skew` (`style_box_flat.h:48`): a shear of every vertex about the style
   * rect's centre, so the box leans without moving. Non-zero skew turns
   * anti-aliasing on (`style_box_flat.cpp:471`), since a sheared edge is diagonal.
   */
  skew: Vec2;
  /** `shadow_color` (`style_box_flat.h:39`, default `Color(0, 0, 0, 0.6)`): the colour at the shadow's inner edge, fading to alpha 0 outward. */
  shadowColor: ControlColor;
  /** `shadow_size` (`style_box_flat.h:52`): how far the shadow grows past the style rect. The default 0 draws no shadow. */
  shadowSize: number;
  /** `shadow_offset` (`style_box_flat.h:53`): displaces the whole shadow. */
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
 * `make_flat_stylebox` (`default_theme.cpp:57-70`) for the fields `StyleBoxFlatData`
 * models. An option left out keeps `StyleBoxFlat`'s constructed default, as the
 * theme builder assigns only a colour, the margins and a corner radius.
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
 * The space a StyleBox's content margins take from a rect: what
 * `StyleBox::get_minimum_size` adds to its content, and what a content rect is
 * inset by. The margins are already effective values.
 */
export function contentMarginSize(box: StyleBoxFlatData): Vec2 {
  return {
    x: box.contentMargin.left + box.contentMargin.right,
    y: box.contentMargin.top + box.contentMargin.bottom,
  };
}
