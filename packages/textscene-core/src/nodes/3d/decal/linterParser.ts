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
  // No upper bound: unlike albedo_mix and normal_fade, these two are curve
  // exponents rather than ratios — Godot documents only "positive values are
  // valid (negative values will be clamped to 0.0)".
  upper_fade: v.float('upper_fade', { min: 0 }),
  lower_fade: v.float('lower_fade', { min: 0 }),
  cull_mask: layerBitmask('cull_mask'),
  // Godot hints these as "0.0,4096.0,0.01,or_greater", i.e. a lower bound only.
  distance_fade_enabled: v.boolean('distance_fade_enabled'),
  distance_fade_begin: v.nonNegativeFloat('distance_fade_begin'),
  distance_fade_length: v.nonNegativeFloat('distance_fade_length'),
});
