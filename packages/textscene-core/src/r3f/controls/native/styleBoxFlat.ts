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
