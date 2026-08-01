/** Decal strict validators for linting (format validation). */

// VisualInstance3D is the immediate validator-bearing base and pulls Node3D in
// turn, so this module still answers for every key Decal is chained to.
import '../visualinstance3d/linterParser.js';
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
  // decal.cpp:254-255 hint these PROPERTY_HINT_EXP_EASING with NO range: an
  // easing-curve editor, not a 0-1 bound. The setters clamp the low end only
  // (`upper_fade = MAX(p_fade, 0.0)`, :89), so min 0 and no maximum.
  upper_fade: v.nonNegativeFloat('upper_fade'),
  lower_fade: v.nonNegativeFloat('lower_fade'),
  cull_mask: layerBitmask('cull_mask'),
  // VisualInstance3D declares `sorting_offset` PROPERTY_USAGE_NONE, so most of
  // its subclasses never serialise it — but `Decal::_validate_property`
  // (scene/3d/decal.cpp:169) restores PROPERTY_USAGE_DEFAULT for this one
  // property, so a Decal really can carry it. No range hint on the binding.
  sorting_offset: v.float('sorting_offset'),
});
