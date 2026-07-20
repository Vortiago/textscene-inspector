/** Decal strict validators for linting (format validation). */

import '../../base/node3d/linterParser.js';
import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { layerBitmask, v } from '../../../linter/validators/index.js';

validatorRegistry.registerAll('Decal', {
  texture_albedo: v.resourceReference('texture_albedo'),
  texture_normal: v.resourceReference('texture_normal'),
  texture_orm: v.resourceReference('texture_orm'),
  texture_emission: v.resourceReference('texture_emission'),
  size: v.vector3('size'),
  modulate: v.color('modulate'),
  albedo_mix: v.float('albedo_mix', { min: 0, max: 1 }),
  emission_energy: v.nonNegativeFloat('emission_energy'),
  normal_fade: v.float('normal_fade', { min: 0, max: 1 }),
  upper_fade: v.float('upper_fade', { min: 0, max: 1 }),
  lower_fade: v.float('lower_fade', { min: 0, max: 1 }),
  cull_mask: layerBitmask('cull_mask'),
});
