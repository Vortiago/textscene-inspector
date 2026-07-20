/**
 * Label3D strict validators for linting.
 * Migrated to the declarative `v` namespace.
 */

import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { v } from '../../../linter/validators/index.js';

const BILLBOARD = { 0: 'DISABLED', 1: 'ENABLED', 2: 'FIXED_Y' };
const HORIZONTAL_ALIGNMENT = { 0: 'LEFT', 1: 'CENTER', 2: 'RIGHT', 3: 'FILL' };

validatorRegistry.registerAll('Label3D', {
  text: v.quotedString('text'),
  pixel_size: v.positiveFloat('pixel_size'),
  billboard: v.enumInt('billboard', 0, 2, BILLBOARD),
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
});
