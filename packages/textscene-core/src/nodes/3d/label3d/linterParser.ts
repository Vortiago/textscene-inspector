/**
 * Label3D strict validators for linting.
 * Migrated to the declarative `v` namespace.
 */

import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { v } from '../../../linter/validators/index.js';

const BILLBOARD = { 0: 'DISABLED', 1: 'ENABLED', 2: 'FIXED_Y' };
const HORIZONTAL_ALIGNMENT = { 0: 'LEFT', 1: 'CENTER', 2: 'RIGHT', 3: 'FILL' };
// ALPHA_CUT_MAX = 4 (scene/3d/label_3d.h:50-56), enforced at label_3d.cpp:1013.
const ALPHA_CUT = { 0: 'DISABLED', 1: 'DISCARD', 2: 'OPAQUE_PREPASS', 3: 'HASH' };
// TEXTURE_FILTER_MAX = 6 (scene/resources/material.h:172-178).
const TEXTURE_FILTER = {
  0: 'NEAREST',
  1: 'LINEAR',
  2: 'NEAREST_WITH_MIPMAPS',
  3: 'LINEAR_WITH_MIPMAPS',
  4: 'NEAREST_WITH_MIPMAPS_ANISOTROPIC',
  5: 'LINEAR_WITH_MIPMAPS_ANISOTROPIC',
};

validatorRegistry.registerAll('Label3D', {
  text: v.quotedString('text'),
  pixel_size: v.positiveFloat('pixel_size'),
  billboard: v.enumInt('billboard', 0, 2, BILLBOARD),
  alpha_cut: v.enumInt('alpha_cut', 0, 3, ALPHA_CUT),
  alpha_scissor_threshold: v.float('alpha_scissor_threshold'),
  modulate: v.color('modulate'),
  outline_size: v.float('outline_size', {
    min: 0,
    message: "Property 'outline_size' must be >= 0",
  }),
  outline_modulate: v.color('outline_modulate'),
  font_size: v.positiveFloat('font_size'),
  // Godot documents line_spacing as "can be negative", so no bound here.
  line_spacing: v.float('line_spacing'),
  horizontal_alignment: v.enumInt('horizontal_alignment', 0, 3, HORIZONTAL_ALIGNMENT),
  no_depth_test: v.boolean('no_depth_test'),
  fixed_size: v.boolean('fixed_size'),
  texture_filter: v.enumInt('texture_filter', 0, 5, TEXTURE_FILTER),
  // Godot's own priorities are signed and unbounded in either direction.
  render_priority: v.int('render_priority'),
  outline_render_priority: v.int('outline_render_priority'),
});
