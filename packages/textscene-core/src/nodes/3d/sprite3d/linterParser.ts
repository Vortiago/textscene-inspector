/**
 * Sprite3D strict validators for linting.
 * Migrated to the declarative `v` namespace (WI-ARCH-1).
 */

import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { v } from '../../../linter/validators/index.js';

const BILLBOARD = { 0: 'DISABLED', 1: 'ENABLED', 2: 'FIXED_Y', 3: 'PARTICLES' };
const ALPHA_CUT = { 0: 'DISABLED', 1: 'DISCARD', 2: 'OPAQUE_PREPASS' };
const AXIS = { 0: 'X_AXIS', 1: 'Y_AXIS', 2: 'Z_AXIS' };

validatorRegistry.registerAll('Sprite3D', {
  texture: v.resourceReference('texture'),
  billboard: v.enumInt('billboard', 0, 3, BILLBOARD),
  alpha_cut: v.enumInt('alpha_cut', 0, 2, ALPHA_CUT),
  axis: v.enumInt('axis', 0, 2, AXIS),
  pixel_size: v.positiveFloat('pixel_size'),
  transparency: v.float('transparency', { min: 0, max: 1 }),
  hframes: v.positiveInt('hframes'),
  vframes: v.positiveInt('vframes'),
  frame: v.int('frame', { min: 0 }),
  offset: v.vector2('offset'),
  frame_coords: v.vector2i('frame_coords'),
  region_rect: v.rect2('region_rect'),
  modulate: v.color('modulate'),
  render_priority: v.int('render_priority'),
});
