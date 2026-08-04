/**
 * Base Control strict validators for linting.
 *
 * Control is the root of the 2D UI family (Label, Button, Panel, the
 * *Containers, …). Registering the shared layout/anchor/offset + theme-override
 * validators here — once, under `'Control'` — makes them apply to every Control
 * subclass through the ValidatorRegistry base-walk (see linter/nodeBaseTypes.ts),
 * closing the gap where the render parser coerced these values while the linter
 * ignored them entirely.
 *
 * Validators are deliberately format-lenient (accept anything the renderer
 * accepts, reject only malformed literals) so widening linter coverage to the
 * whole UI family does not introduce false positives on real Godot scenes.
 */

import '../../../canvasitem/shared/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import { v } from '../../../../linter/validators/index.js';
import { THEME_OVERRIDE_VALIDATORS } from '../../../../linter/validators/themeOverrides.js';

validatorRegistry.registerAll('Control', {
  // Layout regime + anchors/offsets (the free/anchored path).
  // control.cpp:4210, ENUM "Position,Anchors,Container,Uncontrolled" (4 labels,
  // matching LayoutMode 0-3 exactly, control.h:147-152). _set_layout_mode
  // (control.cpp:919-935) assigns unconditionally, no ERR_FAIL.
  layout_mode: v.int('layout_mode', { min: 0, max: 3, hinted: 'control.cpp:4210' }),
  // control.cpp:4245, ENUM built from the preset table ("Custom:-1" plus 16
  // named presets 0-15). Both ends are genuinely enforced, just by two
  // different guards: -1 is special-cased as always valid
  // (_set_anchors_layout_preset early-returns on it, control.cpp:983-988);
  // anything else reaches set_anchors_preset's `ERR_FAIL_INDEX((int)p_preset,
  // 16)` (control.cpp:1116), which also rejects anything below -1.
  anchors_preset: v.int('anchors_preset', {
    min: -1,
    max: 15,
    enforced: { min: 'control.cpp:983', max: 'control.cpp:1116' },
  }),
  anchor_left: v.float('anchor_left'),
  anchor_top: v.float('anchor_top'),
  anchor_right: v.float('anchor_right'),
  anchor_bottom: v.float('anchor_bottom'),
  offset_left: v.float('offset_left'),
  offset_top: v.float('offset_top'),
  offset_right: v.float('offset_right'),
  offset_bottom: v.float('offset_bottom'),
  // control.cpp:4261, ENUM "Left,Right,Both". set_h_grow_direction:
  // `ERR_FAIL_INDEX((int)p_direction, 3)` (control.cpp:861).
  grow_horizontal: v.int('grow_horizontal', { min: 0, max: 2, enforced: 'control.cpp:861' }),
  // control.cpp:4262, ENUM "Top,Bottom,Both". set_v_grow_direction:
  // `ERR_FAIL_INDEX((int)p_direction, 3)` (control.cpp:878).
  grow_vertical: v.int('grow_vertical', { min: 0, max: 2, enforced: 'control.cpp:878' }),
  rotation: v.float('rotation'),
  scale: v.vector2('scale'),
  pivot_offset: v.vector2('pivot_offset'),
  pivot_offset_ratio: v.vector2('pivot_offset_ratio'),

  // Container-child sizing.
  // control.cpp:4275/4276 hint PROPERTY_HINT_FLAGS, not a RANGE — "Fill:1,
  // Expand:2,Shrink Center:4,Shrink End:8" only names the editor's checkbox
  // bits. set_h_size_flags/set_v_size_flags (control.cpp:1840-1860) bare-assign
  // the BitField with no clamp or ERR_FAIL, so no Godot statement backs a
  // floor of 0 either — the previous `min: 0` was invented, not read from a
  // hint, so it is deleted rather than grounded.
  size_flags_horizontal: v.int('size_flags_horizontal'),
  size_flags_vertical: v.int('size_flags_vertical'),
  // control.cpp:4277, "0,20,0.01,or_greater": only the 0 floor is closed.
  // set_stretch_ratio (control.cpp:1868-1875) assigns unconditionally.
  size_flags_stretch_ratio: v.nonNegativeFloat('size_flags_stretch_ratio', {
    hinted: 'control.cpp:4277',
  }),
  custom_minimum_size: v.vector2('custom_minimum_size'),

  // Shared with Window — Godot emits this family from both, identically
  // (control.cpp:432/446 state the same two hints as window.cpp:183/207).
  // Grounding for these two lives in linter/validators/themeOverrides.ts,
  // which this slice does not own.
  ...THEME_OVERRIDE_VALIDATORS,
});
