/**
 * Label3D strict validators for linting.
 * Migrated to the declarative `v` namespace (WI-ARCH-1).
 */

import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { v } from '../../../linter/validators/index.js';

const BILLBOARD = { 0: 'DISABLED', 1: 'ENABLED', 2: 'FIXED_Y' };

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
});
