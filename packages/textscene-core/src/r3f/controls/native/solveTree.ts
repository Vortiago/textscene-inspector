/**
 * `SolveNode` — the Control rect solver's input shape. Built by the
 * `liveSceneTree`-based walker (packet P3, `native/buildSolveTree.ts`); this
 * module only defines the type, so the solver (this packet) and the walker
 * (P3) can be developed against the same contract without either depending on
 * the other's implementation.
 *
 * Pure data, no React, no THREE.
 */

import type { TscnNode } from '../../../parser/types';
import type { ControlColor } from '../../../nodes/2d/ui/control/types';
import type { Vec2 } from './rect';

/**
 * A resolved `StyleBoxFlat`, numbers only — the shape `native/parseStyleBox.ts`
 * (packet P5) produces and `native/styleBoxFlatGeometry.ts` consumes. Defined
 * here (rather than in P5) because `SolveNode.styleBoxes` already needs the
 * shape: a container's minimum-size math (e.g. PanelContainer's content
 * margins) reads a StyleBox's numbers before P5's parser or geometry builder
 * exist.
 *
 * Field names and defaults transcribed from
 * `scene/resources/style_box_flat.h`/`.cpp` (Godot 4.6.3):
 *  - `bg_color` default `Color(0.6, 0.6, 0.6)` (`style_box_flat.h:36`).
 *  - `border_color` default `Color(0.8, 0.8, 0.8)` (`:38`).
 *  - `border_width`, `corner_radius`, `expand_margin` are `real_t[4]`, all
 *    zero by default (`:40-42`), indexed by `Side` (LEFT/TOP/RIGHT/BOTTOM) for
 *    the first two and `Corner` (TOP_LEFT/TOP_RIGHT/BOTTOM_RIGHT/BOTTOM_LEFT)
 *    for radius.
 *  - `content_margin` lives on the `StyleBox` base (`style_box.h:43`), default
 *    `-1` per side meaning "ask `get_style_margin`", which `StyleBoxFlat`
 *    overrides to fall back to the matching `border_width`
 *    (`style_box_flat.cpp::get_style_margin`).
 *  - `draw_center` default `true`, `blend_border` (`border_blend` in the
 *    scene-file property name) default `false` (`style_box_flat.h:44-45`).
 */
export interface StyleBoxFlatData {
  bgColor: ControlColor;
  borderColor: ControlColor;
  borderWidth: { left: number; top: number; right: number; bottom: number };
  cornerRadius: { topLeft: number; topRight: number; bottomRight: number; bottomLeft: number };
  expandMargin: { left: number; top: number; right: number; bottom: number };
  contentMargin: { left: number; top: number; right: number; bottom: number };
  drawCenter: boolean;
  borderBlend: boolean;
}

/**
 * One Control (or 2D-UI node) in the live, already-collapsed scene tree —
 * instance roots merged, sub-scene scope resolved — ready for the solver.
 */
export interface SolveNode {
  /** Dispatcher-absolute path, from the live scene tree. */
  path: string;
  /** The COLLAPSED live node (post instance-merge). */
  node: TscnNode;
  /** From `liveChildGroups`; each child's own scope is already resolved. */
  children: readonly SolveNode[];
  /** This node's `theme_override_styles/*` StyleBoxes, resolved in ITS scope. */
  styleBoxes: Readonly<Record<string, StyleBoxFlatData>>;
  /** `null` until the node's texture (if any) has loaded. */
  textureSize: Vec2 | null;
}
