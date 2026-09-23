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
  // decal.cpp:235 hints "0,1024,0.001,or_greater,suffix:m", so the ceiling is open. set_size
  // (:34) is `size = p_size.maxf(0.001)`, a per-component clamp (core/math/vector3.h:105), so the
  // engine's floor is 0.001, above the hint's 0: a smaller component is altered on load, the
  // error tier.
  size: v.boundedVector3('size', { min: 0.001, enforced: 'decal.cpp:34' }),
  modulate: v.color('modulate'),
  // decal.cpp:248, "0,1,0.01"; set_albedo_mix (:79-83) is a bare assignment.
  albedo_mix: v.float('albedo_mix', { min: 0, max: 1, hinted: 'decal.cpp:248' }),
  // decal.cpp:246, "0,16,0.01,or_greater"; set_emission_energy (:70-73) is a
  // bare assignment.
  emission_energy: v.nonNegativeFloat('emission_energy', { hinted: 'decal.cpp:246' }),
  // decal.cpp:251, "0,0.999,0.001". The ceiling stops one step short because "A Normal Fade of
  // 1.0 causes the decal to be invisible even if fully perpendicular to a surface" (:249).
  // set_normal_fade (:106-109) is a bare assignment.
  normal_fade: v.float('normal_fade', { min: 0, max: 0.999, hinted: 'decal.cpp:251' }),
  // decal.cpp:254-255 hint these PROPERTY_HINT_EXP_EASING with no range: an
  // easing-curve editor, not a 0-1 bound. The setters do clamp the low end
  // (`upper_fade = MAX(p_fade, 0.0)`, :89; `lower_fade = MAX(p_fade, 0.0)`,
  // :98), so min 0 is a real, enforced floor and there is no maximum.
  upper_fade: v.nonNegativeFloat('upper_fade', { enforced: 'decal.cpp:89' }),
  lower_fade: v.nonNegativeFloat('lower_fade', { enforced: 'decal.cpp:98' }),
  cull_mask: layerBitmask('cull_mask', { hinted: 'decal.cpp:263', width: 'uint32' /* decal.h:106 */ }),
  // decal.cpp:258-260. `or_greater` with no `or_less`, so the 0 floor is a real
  // bound and 4096 is only the slider extent. Both setters (:134-146) are bare
  // assignments.
  distance_fade_enabled: v.boolean('distance_fade_enabled'),
  distance_fade_begin: v.nonNegativeFloat('distance_fade_begin', { hinted: 'decal.cpp:259' }),
  distance_fade_length: v.nonNegativeFloat('distance_fade_length', { hinted: 'decal.cpp:260' }),
  // VisualInstance3D declares `sorting_offset` PROPERTY_USAGE_NONE, but
  // `Decal::_validate_property` (scene/3d/decal.cpp:169) restores PROPERTY_USAGE_DEFAULT, so a
  // Decal can carry it. No range hint on the binding.
  sorting_offset: v.float('sorting_offset'),
});
