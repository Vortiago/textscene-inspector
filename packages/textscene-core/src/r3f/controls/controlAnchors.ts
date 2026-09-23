/**
 * Godot's Control anchor model: the anchors, offsets and grow direction a node's
 * `anchors_preset`, `anchor_*`, `offset_*` and `grow_*` mean, which
 * `native/controlRectSolver.ts` turns into a `Rect2`. A type import only, so
 * `.ts`-only consumers read it without React.
 */

import type { ControlProperties } from '../../nodes/2d/ui/control/types.js';

/**
 * `Control::LayoutPreset` (0..15) → `[left, top, right, bottom]` anchors, from the
 * four per-edge `switch`es in `scene/gui/control.cpp::Control::set_anchors_preset`
 * (:1114-1229). `ANCHOR_BEGIN` = 0, `ANCHOR_END` = 1, and CENTER_* anchors at 0.5.
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
 * Whether `Control::_set_anchors_layout_preset`, the setter bound to `anchors_preset`,
 * gets past its early returns (`scene/gui/control.cpp:983-993`). Only
 * `LAYOUT_MODE_ANCHORS` (1) and `LAYOUT_MODE_UNCONTROLLED` (3) open it: "in other
 * modes the anchor preset is non-operational". Anchors and grow direction share it.
 */
function presetApplies(p: ControlProperties): boolean {
  // `data.stored_layout_mode` defaults to POSITION (0) (`control.h:201`), and
  // `SceneState::instantiate` sets properties before parenting
  // (`scene/resources/packed_scene.cpp:492` versus `:541`), so the serialised
  // `layout_mode` is the gate. None, or CONTAINER (2), keeps it closed.
  return p.layoutMode === 1 || p.layoutMode === 3;
}

/**
 * Explicit `anchor_*` wins over `anchors_preset`: `Control::_size_changed` reads the
 * floats, and `set_anchor` has no `layout_mode` check. Absent both, anchors are
 * `(0, 0, 0, 0)`. The setter's third effect, on `offset_*`, is `resolveOffsets`.
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
  // Out of 0..15 the default stays: `-1` returns early (`control.cpp:983-989`), and
  // `set_anchors_preset` refuses the rest (`ERR_FAIL_INDEX((int)p_preset, 16)`).
  if (presetApplies(p) && p.anchorsPreset !== undefined && PRESET_ANCHORS[p.anchorsPreset]) {
    return PRESET_ANCHORS[p.anchorsPreset]!;
  }
  return [0, 0, 0, 0];
}

/**
 * LEFT_WIDE through FULL_RECT, which `_set_anchors_layout_preset` passes as
 * `PRESET_MODE_MINSIZE`, not `PRESET_MODE_KEEP_SIZE` (`control.cpp:1007-1029`): their
 * `new_size` is the minimum size, the other nine's is `get_size()`.
 */
const MINSIZE_PRESETS = new Set([9, 10, 11, 12, 13, 14, 15]);

/**
 * The `offset_*` a preset writes through `set_offsets_preset` (`control.cpp:1231-1345`),
 * each authored side winning. That assumes editor-save order, which
 * `Control::_get_anchors_layout_preset` (`control.cpp:1039-1112`) guarantees and a
 * hand-edited file does not (ADR-0035): `resolveControlLayout` replays file order.
 * @param presetTimeMinimumSize `get_minimum_size()`, the type's own virtual minimum
 *   without `custom_minimum_size`, of the orphan before its own type's properties
 *   apply (a subclass's follow `Control`'s in scene order). A thunk: only the seven
 *   wide presets read it, and it re-runs the registered `MinimumSizeFn`.
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
  // These place a rect of the virtual minimum where the size floor places the
  // combined one, so they move a pixel only when an authored `grow_*`
  // contradicts the preset.
  if (!presetApplies(p) || preset === undefined || !PRESET_ANCHORS[preset]) return authored;

  // The `ADD_PROPERTY` order in control.cpp is the editor's save order, which
  // Godot's parser never enforces on a hand-edited file.
  const derived = presetDerivedOffsets(preset, presetTimeMinimumSize);
  return [
    p.offsetLeft ?? derived[0],
    p.offsetTop ?? derived[1],
    p.offsetRight ?? derived[2],
    p.offsetBottom ?? derived[3],
  ];
}

/**
 * `set_offsets_preset` for `preset` alone. Outside the tree the parent rect is
 * `Rect2()`, so only the `new_size` term survives, and each switch partitions presets
 * as `set_anchors_preset` does: begin, centre and end are `0, -size/2, -size` on
 * left and top, and `+size, +size/2, 0` on right and bottom.
 * @param sizeAtPresetTime `get_size()`, which `KEEP_SIZE` reads: the orphan `size_cache`
 *   in a file-order replay, and (0, 0) in editor-save order, where the preset precedes
 *   every offset.
 */
function presetDerivedOffsets(
  preset: number,
  presetTimeMinimumSize: () => { x: number; y: number },
  sizeAtPresetTime: { x: number; y: number } = { x: 0, y: 0 }
): [number, number, number, number] {
  const [al, at, ar, ab] = PRESET_ANCHORS[preset]!;
  const size = MINSIZE_PRESETS.has(preset) ? presetTimeMinimumSize() : sizeAtPresetTime;
  // `0 - x`, not a unary minus: a zero-size begin edge stays +0, and -0 fails a
  // deep-equality assertion.
  return [0 - size.x * al, 0 - size.y * at, size.x * (1 - ar), size.y * (1 - ab)];
}

/**
 * `get_size()` for a node that has never been in a tree. `Control::_size_changed`
 * writes `data.size_cache` outside its `is_inside_tree()` guard, so an earlier
 * `set_offset` gives an orphan a real size: with a zero parent rect every
 * `edge_pos` is the offset itself, floored at the combined minimum.
 */
function orphanSizeCache(
  state: ControlLayoutState,
  min: { x: number; y: number }
): { x: number; y: number } {
  return {
    x: Math.max(state.offsets[2] - state.offsets[0], min.x),
    y: Math.max(state.offsets[3] - state.offsets[1], min.y),
  };
}

/** `Control::GrowDirection` (`control.h:59-62`). */
const GROW_DIRECTION_BEGIN = 0;
const GROW_DIRECTION_END = 1;
const GROW_DIRECTION_BOTH = 2;

/**
 * `Control::LayoutPreset` (0..15) → implied `grow_horizontal`, from the first `switch`
 * in `scene/gui/control.cpp::Control::set_grow_direction_preset` (:1375-1399): left-edge
 * presets grow END, right-edge ones BEGIN, and centred or spanning ones BOTH.
 */
const PRESET_GROW_HORIZONTAL: Record<number, number> = {
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
const PRESET_GROW_VERTICAL: Record<number, number> = {
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
 * `[grow_horizontal, grow_vertical]`: which way `Control::_size_changed`'s floor
 * (`control.cpp:1773-1797`) moves a rect it clamps up to the combined minimum. The
 * editor writes one only when it contradicts the preset, so an authored value wins.
 */
export function resolveGrowDirection(p: ControlProperties): [number, number] {
  // `_set_anchors_layout_preset` ends with `set_grow_direction_preset`
  // (`control.cpp:1032`), behind the `presetApplies` gate. A preset outside 0..15,
  // `-1` included (`:983-989`), matches no `case` and keeps the struct default.
  const preset = presetApplies(p) ? p.anchorsPreset : undefined;
  const h = preset !== undefined ? PRESET_GROW_HORIZONTAL[preset] : undefined;
  const v = preset !== undefined ? PRESET_GROW_VERTICAL[preset] : undefined;
  return [p.growHorizontal ?? h ?? GROW_DIRECTION_END, p.growVertical ?? v ?? GROW_DIRECTION_END];
}

// --- File-order-aware resolution (ADR-0035, Option B) -----------------------

/**
 * A node's raw `.tscn` property keys in file order, or `undefined` when that order
 * is unknown or unreliable. `controlLayoutOrder(n)` in `native/solveTree.ts` reads
 * `TscnNode.rawPropertiesOrderReliable` (ADR-0035).
 */
export type ControlLayoutOrder = readonly string[] | undefined;

export interface ControlLayoutResolution {
  anchors: [number, number, number, number];
  offsets: [number, number, number, number];
  growHorizontal: number;
  growVertical: number;
}

/** `Control::Data`'s struct defaults for the fields this simulation tracks (`control.h:201-210`). */
const STRUCT_DEFAULT_LAYOUT_MODE = 0; // LAYOUT_MODE_POSITION, control.h:201
const STRUCT_DEFAULT_ANCHORS: [number, number, number, number] = [0, 0, 0, 0]; // ANCHOR_BEGIN x4, control.h:205
const STRUCT_DEFAULT_OFFSETS: [number, number, number, number] = [0, 0, 0, 0]; // control.h:204

interface ControlLayoutState {
  storedLayoutMode: number;
  anchors: [number, number, number, number];
  offsets: [number, number, number, number];
  growHorizontal: number;
  growVertical: number;
}

function initialControlLayoutState(): ControlLayoutState {
  return {
    storedLayoutMode: STRUCT_DEFAULT_LAYOUT_MODE,
    anchors: [...STRUCT_DEFAULT_ANCHORS],
    offsets: [...STRUCT_DEFAULT_OFFSETS],
    growHorizontal: GROW_DIRECTION_END,
    growVertical: GROW_DIRECTION_END,
  };
}

/**
 * `Control::_set_layout_mode` with `p_mode == LAYOUT_MODE_POSITION` (0) always runs
 * (`control.cpp:919-935`, the reset at `:927-930`) `set_anchors_and_offsets_preset(PRESET_TOP_LEFT,
 * PRESET_MODE_KEEP_SIZE)` then `set_grow_direction_preset(PRESET_TOP_LEFT)`. It wipes
 * earlier `anchor_*`/`offset_*`/`grow_*` with no `stored_layout_mode` gate (ADR-0035).
 */
function applyLayoutModePositionReset(
  state: ControlLayoutState,
  presetTimeMinimumSize: () => { x: number; y: number }
): void {
  // Resolved once per event: the size cache floors at it, and a MINSIZE preset
  // would re-run the unmemoised solve. TOP_LEFT is `KEEP_SIZE`, so its `new_size`
  // is the orphan `size_cache` an earlier `set_offset` wrote, not zero.
  const minimumSize = presetTimeMinimumSize();
  const sizeAtPresetTime = orphanSizeCache(state, minimumSize);
  state.anchors = [...STRUCT_DEFAULT_ANCHORS];
  state.offsets = presetDerivedOffsets(0, () => minimumSize, sizeAtPresetTime);
  state.growHorizontal = PRESET_GROW_HORIZONTAL[0]!;
  state.growVertical = PRESET_GROW_VERTICAL[0]!;
}

/**
 * `Control::_set_anchors_layout_preset`'s three side effects (`control.cpp:1004,1007-1029,1032`).
 * The caller checks `-1` and the `stored_layout_mode` gate. This guards
 * `ERR_FAIL_INDEX((int)p_preset, 16)` in `set_anchors_preset`: out of range, no
 * switch has a `case`, and Godot changes nothing.
 */
function applyAnchorsPreset(
  state: ControlLayoutState,
  preset: number,
  presetTimeMinimumSize: () => { x: number; y: number }
): void {
  const anchors = PRESET_ANCHORS[preset];
  if (!anchors) return;
  // One resolve per event, as in `applyLayoutModePositionReset`.
  const minimumSize = presetTimeMinimumSize();
  const sizeAtPresetTime = orphanSizeCache(state, minimumSize);
  state.anchors = [...anchors];
  state.offsets = presetDerivedOffsets(preset, () => minimumSize, sizeAtPresetTime);
  state.growHorizontal = PRESET_GROW_HORIZONTAL[preset]!;
  state.growVertical = PRESET_GROW_VERTICAL[preset]!;
}

const ANCHOR_KEY_SIDE: Record<string, number> = {
  anchor_left: 0,
  anchor_top: 1,
  anchor_right: 2,
  anchor_bottom: 3,
};
const OFFSET_KEY_SIDE: Record<string, number> = {
  offset_left: 0,
  offset_top: 1,
  offset_right: 2,
  offset_bottom: 3,
};

/** This property bag's per-side anchor/offset floats, indexed the same way `PRESET_ANCHORS` is. */
function anchorValue(p: ControlProperties, side: number): number | undefined {
  return [p.anchorLeft, p.anchorTop, p.anchorRight, p.anchorBottom][side];
}
function offsetValue(p: ControlProperties, side: number): number | undefined {
  return [p.offsetLeft, p.offsetTop, p.offsetRight, p.offsetBottom][side];
}

/**
 * Replays a Control's raw `.tscn` keys in file order through the setters (ADR-0035,
 * Option B), so each new interaction is one more event, not a pairwise rule. With
 * `orderedKeys` undefined (a merged instance root, or a hand-built node) it falls
 * back to the editor-save-order resolvers.
 */
export function resolveControlLayout(
  p: ControlProperties,
  orderedKeys: ControlLayoutOrder,
  presetTimeMinimumSize: () => { x: number; y: number }
): ControlLayoutResolution {
  if (!orderedKeys) {
    const [growHorizontal, growVertical] = resolveGrowDirection(p);
    return {
      anchors: resolveAnchors(p),
      offsets: resolveOffsets(p, presetTimeMinimumSize),
      growHorizontal,
      growVertical,
    };
  }

  const state = initialControlLayoutState();

  for (const key of orderedKeys) {
    if (key === 'layout_mode') {
      if (p.layoutMode === undefined) continue; // unparseable: no event
      state.storedLayoutMode = p.layoutMode;
      if (state.storedLayoutMode === STRUCT_DEFAULT_LAYOUT_MODE) {
        applyLayoutModePositionReset(state, presetTimeMinimumSize);
      }
      continue;
    }
    if (key === 'anchors_preset') {
      if (p.anchorsPreset === undefined) continue;
      if (p.anchorsPreset === -1) continue; // custom-anchors sentinel, control.cpp:983-989: no effect
      // The gate: only ANCHORS (1) or UNCONTROLLED (3), control.cpp:991-993.
      if (state.storedLayoutMode !== 1 && state.storedLayoutMode !== 3) continue;
      applyAnchorsPreset(state, p.anchorsPreset, presetTimeMinimumSize);
      continue;
    }
    // Not modelled (no ADR-0035 pair): `_set_anchor` (`control.cpp:754-757`) pushes the
    // opposite anchor on a cross (`control.cpp:758-786`, `p_push_opposite_anchor` defaults
    // `true`, `control.h:495`). `p_keep_offset` keeps offsets. `Range::_calc_value`'s
    // step snap (`range.cpp:184-186`) has no Control analogue.
    if (key in ANCHOR_KEY_SIDE) {
      const side = ANCHOR_KEY_SIDE[key]!;
      const v = anchorValue(p, side);
      if (v !== undefined) state.anchors[side] = v;
      continue;
    }
    if (key in OFFSET_KEY_SIDE) {
      const side = OFFSET_KEY_SIDE[key]!;
      const v = offsetValue(p, side);
      if (v !== undefined) state.offsets[side] = v;
      continue;
    }
    if (key === 'grow_horizontal') {
      if (p.growHorizontal !== undefined) state.growHorizontal = p.growHorizontal;
      continue;
    }
    if (key === 'grow_vertical') {
      if (p.growVertical !== undefined) state.growVertical = p.growVertical;
    }
  }

  return {
    anchors: state.anchors,
    offsets: state.offsets,
    growHorizontal: state.growHorizontal,
    growVertical: state.growVertical,
  };
}
