/**
 * GPUParticlesCollisionSDF3D strict validators: format and range checks.
 *
 * Declare only GPUParticlesCollisionSDF3D's OWN members: the ones doc/classes/GPUParticlesCollisionSDF3D.xml
 * lists without an `overrides=` attribute. Everything from GPUParticlesCollision3D up is
 * registered on the ancestor and delivered by the NODE_BASE_TYPES base-walk, so
 * re-declaring an inherited key shadows it and duplicates the rule.
 */

import '../shared/linterParser.js';
import { validatorRegistry } from '../../../../../linter/ValidatorRegistry.js';
import { layerBitmask, v } from '../../../../../linter/validators/index.js';

// gpu_particles_collision_3d.cpp:555, PROPERTY_HINT_ENUM "16,32,64,128,256,512": 6
// entries, so the .tscn stores the INDEX (0-5), not the literal texel count.
// RESOLUTION_MAX (6) is a sentinel for array sizing, absent from the hint's enum
// list, so it is not a legal stored value.
const RESOLUTION = { 0: '16', 1: '32', 2: '64', 3: '128', 4: '256', 5: '512' };

validatorRegistry.registerAll('GPUParticlesCollisionSDF3D', {
  // gpu_particles_collision_3d.cpp:554, PROPERTY_HINT_RANGE
  // "0.01,1024,0.01,or_greater,suffix:m": `or_greater` softens only the stated
  // max, so 1024 is not a cap; the min carries no `or_less`, so 0.01 is a hard
  // floor on every component.
  size: v.boundedVector3('size', { min: 0.01 }),
  // gpu_particles_collision_3d.cpp:555, see RESOLUTION above.
  resolution: v.enumInt('resolution', 0, 5, RESOLUTION),
  // gpu_particles_collision_3d.cpp:556, PROPERTY_HINT_RANGE "0.0,2.0,0.01,suffix:m":
  // no `or_greater`/`or_less`, so both 0.0 and 2.0 are hard bounds.
  thickness: v.float('thickness', { min: 0.0, max: 2.0 }),
  // gpu_particles_collision_3d.cpp:557, PROPERTY_HINT_LAYERS_3D_RENDER.
  bake_mask: layerBitmask('bake_mask'),
  // gpu_particles_collision_3d.cpp:558, PROPERTY_HINT_RESOURCE_TYPE "Texture3D",
  // with a non-empty setter ("set_texture"): unlike GPUParticlesCollisionHeightField3D's
  // texture, which is getter-only and gets no validator.
  texture: v.resourceReference('texture'),
});
