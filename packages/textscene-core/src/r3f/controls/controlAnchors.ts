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
 * Whether `anchors_preset` is OPERATIONAL on a node, i.e. whether
 * `Control::_set_anchors_layout_preset` — the setter actually bound to that
 * property — gets past its two early returns (`scene/gui/control.cpp:983-993`)
 * and applies anything at all.
 *
 * The gate reads `data.stored_layout_mode`, whose struct default is
 * `LAYOUT_MODE_POSITION` (0) (`control.h:201`), and a scene's properties are
 * applied while the node is still an orphan — `SceneState::instantiate` sets
 * every property before the `_add_child_nocheck` that would let
 * `NOTIFICATION_PARENTED` recompute the stored mode
 * (`scene/resources/packed_scene.cpp:492` vs `:541`). So the serialized
 * `layout_mode` line IS the gate: only `LAYOUT_MODE_ANCHORS` (1) and
 * `LAYOUT_MODE_UNCONTROLLED` (3) open it, and a node that authors no
 * `layout_mode` at all — like every container-managed child, which authors
 * `LAYOUT_MODE_CONTAINER` (2) — leaves the preset non-operational, "in other
 * modes the anchor preset is non-operational and shouldn't be set to
 * anything".
 *
 * Both halves of the setter's effect — anchors and grow direction — are behind
 * this single gate, so both resolvers below share it.
 */
function presetApplies(p: ControlProperties): boolean {
  return p.layoutMode === 1 || p.layoutMode === 3;
}

/**
 * Explicit `anchor_*` properties win over `anchors_preset` (the scene file
 * carries both once a preset is applied in the editor, but the four explicit
 * floats are what `Control::_size_changed` actually reads, and `set_anchor`
 * carries no `layout_mode` check of its own so an authored float lands
 * whatever the mode); absent either, anchors default to `(0, 0, 0, 0)`.
 *
 * The preset is consulted only through `presetApplies` — the same gate
 * `resolveGrowDirection` uses, since one setter applies both. A preset outside
 * 0..15, notably the `-1` custom-anchors sentinel, likewise leaves anchors at
 * the default: `_set_anchors_layout_preset` returns on `-1` before doing
 * anything (`control.cpp:983-989`), and `set_anchors_preset` rejects anything
 * else out of range outright (`ERR_FAIL_INDEX((int)p_preset, 16)`).
 *
 * The setter's third effect — `set_offsets_preset` rewriting `offset_*` — is
 * `resolveOffsets` below.
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
  if (presetApplies(p) && p.anchorsPreset !== undefined && PRESET_ANCHORS[p.anchorsPreset]) {
    return PRESET_ANCHORS[p.anchorsPreset]!;
  }
  return [0, 0, 0, 0];
}

/**
 * The seven presets `_set_anchors_layout_preset` passes to `set_offsets_preset`
 * as `PRESET_MODE_MINSIZE` rather than `PRESET_MODE_KEEP_SIZE`
 * (`control.cpp:1007-1029`): the wide ones, LEFT_WIDE through FULL_RECT. The
 * distinction is which `new_size` the offsets are computed from — the node's
 * minimum size for these, its current `get_size()` for the other nine.
 */
const MINSIZE_PRESETS = new Set([9, 10, 11, 12, 13, 14, 15]);

/**
 * The `offset_left/top/right/bottom` a preset writes as a side effect —
 * `set_offsets_preset` (`control.cpp:1231-1345`), which
 * `_set_anchors_layout_preset` calls right after `set_anchors_preset`.
 *
 * `presetTimeMinimumSize` is `get_minimum_size()` — the type's OWN virtual
 * contribution, NOT `get_combined_minimum_size()`, so `custom_minimum_size`
 * does not enter — evaluated in the state the node is in when the property is
 * applied: an orphan with none of its own type's properties set yet, since
 * `SceneState::instantiate` walks a node's properties in the order the scene
 * lists them and a subclass's come after `Control`'s. It is a thunk because
 * only the seven wide presets read it, and computing it means running a
 * registered `MinimumSizeFn` a second time — work every other node, which is
 * nearly all of them, would throw away.
 *
 * That orphanhood is what collapses the four per-edge `switch`es to one line
 * per side. Each reads `parent_rect = get_parent_anchorable_rect()`, which is
 * `Rect2()` outside the tree, so every `parent_rect`-scaled term vanishes and
 * only the `new_size` term survives; and each switch's three case lists are
 * edge-for-edge the SAME partition `set_anchors_preset` uses, so "which list
 * this preset is in" is exactly "what this preset anchors that edge at". The
 * begin/centre/end constants that remain are `0 / -size/2 / -size` on the
 * left and top, and `+size / +size/2 / 0` on the right and bottom.
 *
 * An authored `offset_*` wins per side: the four floats are serialized after
 * `anchors_preset` (`control.cpp`'s `ADD_PROPERTY` order), so they are applied
 * on top of whatever the preset wrote. The gate is `presetApplies` again, and
 * a preset outside 0..15 writes nothing for the same reasons the anchors half
 * does.
 *
 * This matters where the min-size floor does not already reproduce it. Because
 * the offsets place a rect of the VIRTUAL minimum where the floor would place
 * one of the COMBINED minimum — never smaller — the two agree whenever the
 * grow directions the floor uses are the preset's own. They part company when
 * a scene authors a `grow_horizontal`/`grow_vertical` that CONTRADICTS its
 * preset, which is the only case where these offsets move a pixel.
 */
export function resolveOffsets(
  p: ControlProperties,
  presetTimeMinimumSize: () => { x: number; y: number }
): [number, number, number, number] {
  const authored: [number, number, number, number] = [
    p.offsetLeft ?? 0,
    p.offsetTop ?? 0,
    p.offsetRight ?? 0,
    p.offsetBottom ?? 0,
  ];
  const preset = p.anchorsPreset;
  if (!presetApplies(p) || preset === undefined || !PRESET_ANCHORS[preset]) return authored;

  const [al, at, ar, ab] = PRESET_ANCHORS[preset]!;
  // `KEEP_SIZE` reads `get_size()`, which is (0, 0) on a node that has never
  // been in a tree — so only the wide presets carry a non-zero `new_size`.
  const size = MINSIZE_PRESETS.has(preset) ? presetTimeMinimumSize() : { x: 0, y: 0 };

  // Written as `0 - …` rather than a unary minus so a zero-size begin edge
  // yields +0: negative zero is a distinct value to a deep-equality assertion.
  return [
    p.offsetLeft ?? 0 - size.x * al,
    p.offsetTop ?? 0 - size.y * at,
    p.offsetRight ?? size.x * (1 - ar),
    p.offsetBottom ?? size.y * (1 - ab),
  ];
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
 * Derivation is gated by `presetApplies`, exactly as Godot gates it — the same
 * early return that gates `resolveAnchors`, since one setter applies both. A
 * preset outside 0..15 — notably the `-1` custom-anchors sentinel, which
 * `_set_anchors_layout_preset` returns on before doing anything (`:983-989`) —
 * likewise leaves it at the struct default, matching two `switch`es that carry
 * no `default:` case.
 */
export function resolveGrowDirection(p: ControlProperties): [number, number] {
  const preset = presetApplies(p) ? p.anchorsPreset : undefined;
  const h = preset !== undefined ? PRESET_GROW_HORIZONTAL[preset] : undefined;
  const v = preset !== undefined ? PRESET_GROW_VERTICAL[preset] : undefined;
  return [p.growHorizontal ?? h ?? GROW_DIRECTION_END, p.growVertical ?? v ?? GROW_DIRECTION_END];
}
