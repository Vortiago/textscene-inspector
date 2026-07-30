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

import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import { v } from '../../../../linter/validators/index.js';

validatorRegistry.registerAll('Control', {
  // CanvasItem visibility / tint.
  visible: v.boolean('visible'),
  modulate: v.color('modulate'),
  self_modulate: v.color('self_modulate'),

  // Layout regime + anchors/offsets (the free/anchored path).
  layout_mode: v.int('layout_mode', { min: 0, max: 3 }),
  anchors_preset: v.int('anchors_preset', { min: -1, max: 15 }),
  anchor_left: v.float('anchor_left'),
  anchor_top: v.float('anchor_top'),
  anchor_right: v.float('anchor_right'),
  anchor_bottom: v.float('anchor_bottom'),
  offset_left: v.float('offset_left'),
  offset_top: v.float('offset_top'),
  offset_right: v.float('offset_right'),
  offset_bottom: v.float('offset_bottom'),
  grow_horizontal: v.int('grow_horizontal', { min: 0, max: 2 }),
  grow_vertical: v.int('grow_vertical', { min: 0, max: 2 }),
  rotation: v.float('rotation'),
  scale: v.vector2('scale'),
  pivot_offset: v.vector2('pivot_offset'),
  pivot_offset_ratio: v.vector2('pivot_offset_ratio'),

  // Container-child sizing.
  size_flags_horizontal: v.int('size_flags_horizontal', { min: 0 }),
  size_flags_vertical: v.int('size_flags_vertical', { min: 0 }),
  size_flags_stretch_ratio: v.nonNegativeFloat('size_flags_stretch_ratio'),
  custom_minimum_size: v.vector2('custom_minimum_size'),

  // Per-instance theme overrides (grouped keys → one validator each).
  'theme_override_colors/*': v.color('theme_override_colors'),
  // scene/gui/control.cpp:432: PROPERTY_HINT_RANGE, "-16384,16384" — both bounds hard.
  'theme_override_constants/*': v.int('theme_override_constants', { min: -16384, max: 16384 }),
  // scene/gui/control.cpp:446: PROPERTY_HINT_RANGE, "1,256,1,or_greater,suffix:px" —
  // min 1 is hard; `or_greater` makes 256 a soft editor bound, so it is not capped.
  'theme_override_font_sizes/*': v.int('theme_override_font_sizes', { min: 1 }),
  'theme_override_styles/*': v.resourceReference('theme_override_styles'),
  'theme_override_fonts/*': v.resourceReference('theme_override_fonts'),
  // scene/gui/control.cpp:452: PROPERTY_HINT_RESOURCE_TYPE, "Texture2D".
  'theme_override_icons/*': v.resourceReference('theme_override_icons'),
});
