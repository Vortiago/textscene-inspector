/**
 * FogMaterial property validation (`scene/resources/3d/fog_material.cpp:125-130`). The density's
 * hint is open at both ends, so it bounds nothing. `set_height_falloff` and `set_edge_fade` raise
 * a negative value to 0 (`:65`, `:74`), an error.
 */

// Registers Material, so the inherited keys resolve when this module loads alone.
import '../material/linterValidators.js';
import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { v } from '../../../linter/validators/index.js';

validatorRegistry.registerAll('FogMaterial', {
  density: v.float('density'),
  albedo: v.color('albedo'),
  emission: v.color('emission'),
  height_falloff: v.float('height_falloff', { min: 0, enforced: 'fog_material.cpp:65' }),
  edge_fade: v.float('edge_fade', { min: 0, enforced: 'fog_material.cpp:74' }),
  density_texture: v.resourceReference('density_texture'),
});
