/**
 * Godot's Control anchor model, as plain data and two pure resolvers: which
 * four fractions a node's `anchors_preset` / `anchor_*` pair actually means,
 * and which grow direction that same preset implies, both resolved by
 * `native/controlRectSolver.ts` into a numeric `Rect2`.
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

/** `Control::GrowDirection` (`control.h:59-62`). */
const GROW_DIRECTION_BEGIN = 0;
const GROW_DIRECTION_END = 1;
const GROW_DIRECTION_BOTH = 2;

/**
 * `Control::LayoutPreset` (0..15) → the `grow_horizontal` it implies.
 * Transcribed from the first `switch` in `scene/gui/control.cpp::Control::
 * set_grow_direction_preset` (:1375-1399): the LEFT-edge presets grow END
 * (away from the left anchor), the RIGHT-edge ones grow BEGIN, and every
 * horizontally-centred or horizontally-spanning one grows BOTH.
 */
export const PRESET_GROW_HORIZONTAL: Record<number, number> = {
  0: GROW_DIRECTION_END, // TOP_LEFT
  1: GROW_DIRECTION_BEGIN, // TOP_RIGHT
  2: GROW_DIRECTION_END, // BOTTOM_LEFT
  3: GROW_DIRECTION_BEGIN, // BOTTOM_RIGHT
  4: GROW_DIRECTION_END, // CENTER_LEFT
  5: GROW_DIRECTION_BOTH, // CENTER_TOP
  6: GROW_DIRECTION_BEGIN, // CENTER_RIGHT
  7: GROW_DIRECTION_BOTH, // CENTER_BOTTOM
  8: GROW_DIRECTION_BOTH, // CENTER
  9: GROW_DIRECTION_END, // LEFT_WIDE
  10: GROW_DIRECTION_BOTH, // TOP_WIDE
  11: GROW_DIRECTION_BEGIN, // RIGHT_WIDE
  12: GROW_DIRECTION_BOTH, // BOTTOM_WIDE
  13: GROW_DIRECTION_BOTH, // VCENTER_WIDE
  14: GROW_DIRECTION_BOTH, // HCENTER_WIDE
  15: GROW_DIRECTION_BOTH, // FULL_RECT
};

/**
 * `Control::LayoutPreset` (0..15) → the `grow_vertical` it implies. The
 * second `switch` in the same function (`control.cpp:1401-1427`), by the
 * mirrored rule: TOP-edge presets grow END, BOTTOM-edge ones BEGIN, and every
 * vertically-centred or vertically-spanning one BOTH.
 */
export const PRESET_GROW_VERTICAL: Record<number, number> = {
  0: GROW_DIRECTION_END, // TOP_LEFT
  1: GROW_DIRECTION_END, // TOP_RIGHT
  2: GROW_DIRECTION_BEGIN, // BOTTOM_LEFT
  3: GROW_DIRECTION_BEGIN, // BOTTOM_RIGHT
  4: GROW_DIRECTION_BOTH, // CENTER_LEFT
  5: GROW_DIRECTION_END, // CENTER_TOP
  6: GROW_DIRECTION_BOTH, // CENTER_RIGHT
  7: GROW_DIRECTION_BEGIN, // CENTER_BOTTOM
  8: GROW_DIRECTION_BOTH, // CENTER
  9: GROW_DIRECTION_BOTH, // LEFT_WIDE
  10: GROW_DIRECTION_END, // TOP_WIDE
  11: GROW_DIRECTION_BOTH, // RIGHT_WIDE
  12: GROW_DIRECTION_BEGIN, // BOTTOM_WIDE
  13: GROW_DIRECTION_BOTH, // VCENTER_WIDE
  14: GROW_DIRECTION_BOTH, // HCENTER_WIDE
  15: GROW_DIRECTION_BOTH, // FULL_RECT
};

/**
 * `[grow_horizontal, grow_vertical]` — which way a Control's rect moves when
 * `Control::_size_changed`'s floor (`control.cpp:1773-1797`) has to clamp it
 * up to its combined minimum size.
 *
 * A scene file rarely says: applying `anchors_preset` sets the grow direction
 * as a SIDE EFFECT, since `Control::_set_anchors_layout_preset` — the setter
 * actually bound to that property — ends by calling `set_grow_direction_preset`
 * (`control.cpp:1032`), and the editor re-derives rather than re-serializes the
 * implied value. So an explicitly authored `grow_horizontal`/`grow_vertical`
 * wins (it is written only when it CONTRADICTS the preset), and otherwise the
 * preset's own table supplies it.
 *
 * Derivation is gated exactly as Godot gates it (`control.cpp:991-993`):
 * `layout_mode` must be `LAYOUT_MODE_ANCHORS` (1) or `LAYOUT_MODE_UNCONTROLLED`
 * (3), else the preset is non-operational and the whole setter returns early —
 * a container-managed child (2) or a free one (0) keeps the raw struct default
 * even with an `anchors_preset` on the node. A preset outside 0..15 — notably
 * the `-1` custom-anchors sentinel, which `_set_anchors_layout_preset` returns
 * on before doing anything (`:983-989`) — likewise leaves it at that default,
 * matching two `switch`es that carry no `default:` case.
 */
export function resolveGrowDirection(p: ControlProperties): [number, number] {
  const presetApplies = p.layoutMode === 1 || p.layoutMode === 3;
  const preset = presetApplies ? p.anchorsPreset : undefined;
  const h = preset !== undefined ? PRESET_GROW_HORIZONTAL[preset] : undefined;
  const v = preset !== undefined ? PRESET_GROW_VERTICAL[preset] : undefined;
  return [p.growHorizontal ?? h ?? GROW_DIRECTION_END, p.growVertical ?? v ?? GROW_DIRECTION_END];
}
