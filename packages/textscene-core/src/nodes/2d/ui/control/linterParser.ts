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
import { v, layerBitmask } from '../../../../linter/validators/index.js';

/** `CanvasItem::TextureFilter` (`scene/main/canvas_item.h:52-60`). */
const CANVAS_ITEM_TEXTURE_FILTER = {
  0: 'PARENT_NODE',
  1: 'NEAREST',
  2: 'LINEAR',
  3: 'NEAREST_WITH_MIPMAPS',
  4: 'LINEAR_WITH_MIPMAPS',
  5: 'NEAREST_WITH_MIPMAPS_ANISOTROPIC',
  6: 'LINEAR_WITH_MIPMAPS_ANISOTROPIC',
};

/** `CanvasItem::TextureRepeat` (`scene/main/canvas_item.h:63-69`). */
const CANVAS_ITEM_TEXTURE_REPEAT = {
  0: 'PARENT_NODE',
  1: 'DISABLED',
  2: 'ENABLED',
  3: 'MIRROR',
};

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

  // CanvasItem draw-order + sampler properties. `z_index`'s -4096..4096 is a
  // PROPERTY_HINT_RANGE for the inspector slider only, not a setter guard, so
  // (like Node2D's own z_index validator) it stays unbounded here too.
  z_index: v.strictInt('z_index'),
  show_behind_parent: v.boolean('show_behind_parent'),
  light_mask: layerBitmask('light_mask'),
  texture_filter: v.enumInt('texture_filter', 0, 6, CANVAS_ITEM_TEXTURE_FILTER),
  texture_repeat: v.enumInt('texture_repeat', 0, 3, CANVAS_ITEM_TEXTURE_REPEAT),

  // Per-instance theme overrides (grouped keys → one validator each).
  'theme_override_colors/*': v.color('theme_override_colors'),
  'theme_override_constants/*': v.int('theme_override_constants'),
  'theme_override_font_sizes/*': v.int('theme_override_font_sizes', { min: 0 }),
  'theme_override_styles/*': v.resourceReference('theme_override_styles'),
  'theme_override_fonts/*': v.resourceReference('theme_override_fonts'),
});
