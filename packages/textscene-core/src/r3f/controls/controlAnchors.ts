/**
 * Godot's Control anchor model, as plain data and one pure resolver: which
 * four fractions a node's `anchors_preset` / `anchor_*` pair actually means,
 * resolved by `native/controlRectSolver.ts` into a numeric `Rect2`.
 *
 * Framework-free (a type import only), so the `.ts`-only consumers that must
 * not pull in React can read it.
 */

import type { ControlProperties } from '../../nodes/2d/ui/control/types.js';

/**
 * `Control::LayoutPreset` (0..15) → `[anchor_left, anchor_top, anchor_right,
 * anchor_bottom]`. Transcribed from the four per-edge `switch` statements in
 * `scene/gui/control.cpp::Control::set_anchors_preset` (:1114-1229):
 * `ANCHOR_BEGIN` = 0, `ANCHOR_END` = 1, and the four CENTER_* presets anchor
 * that edge at 0.5.
 */
export const PRESET_ANCHORS: Record<number, [number, number, number, number]> = {
  0: [0, 0, 0, 0], // TOP_LEFT
  1: [1, 0, 1, 0], // TOP_RIGHT
  2: [0, 1, 0, 1], // BOTTOM_LEFT
  3: [1, 1, 1, 1], // BOTTOM_RIGHT
  4: [0, 0.5, 0, 0.5], // CENTER_LEFT
  5: [0.5, 0, 0.5, 0], // CENTER_TOP
  6: [1, 0.5, 1, 0.5], // CENTER_RIGHT
  7: [0.5, 1, 0.5, 1], // CENTER_BOTTOM
  8: [0.5, 0.5, 0.5, 0.5], // CENTER
  9: [0, 0, 0, 1], // LEFT_WIDE
  10: [0, 0, 1, 0], // TOP_WIDE
  11: [1, 0, 1, 1], // RIGHT_WIDE
  12: [0, 1, 1, 1], // BOTTOM_WIDE
  13: [0.5, 0, 0.5, 1], // VCENTER_WIDE
  14: [0, 0.5, 1, 0.5], // HCENTER_WIDE
  15: [0, 0, 1, 1], // FULL_RECT
};

/**
 * Explicit `anchor_*` properties win over `anchors_preset` (the scene file
 * carries both once a preset is applied in the editor, but the four explicit
 * floats are what `Control::_size_changed` actually reads); absent either,
 * anchors default to `(0, 0, 0, 0)` — `layout_mode = 0` (Position) leaves
 * anchors at that default and encodes position/size entirely through offsets.
 */
export function resolveAnchors(p: ControlProperties): [number, number, number, number] {
  const hasExplicit =
    p.anchorLeft !== undefined ||
    p.anchorTop !== undefined ||
    p.anchorRight !== undefined ||
    p.anchorBottom !== undefined;
  if (hasExplicit) {
    return [p.anchorLeft ?? 0, p.anchorTop ?? 0, p.anchorRight ?? 0, p.anchorBottom ?? 0];
  }
  if (p.anchorsPreset !== undefined && PRESET_ANCHORS[p.anchorsPreset]) {
    return PRESET_ANCHORS[p.anchorsPreset]!;
  }
  return [0, 0, 0, 0];
}
