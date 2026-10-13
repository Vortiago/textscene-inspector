/**
 * AreaLight3D strict validators, grounded in 4.7.2, the first release with the class. The base-walk
 * AreaLight3D → Light3D → Node3D delivers the light_* and shadow_* validators.
 */

import '../shared/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import { v } from '../../../../linter/validators/index.js';

/**
 * 4.7.2: the setter stores `p_size.maxf(0.0f)` (light_3d.cpp:724), an enforced floor. The
 * property's PROPERTY_HINT_LINK (:767) is a UI toggle, not a second bound.
 */
const areaSizeValidator = v.vector2('area_size', {
  components: (parts) =>
    parts.some((component) => component < 0)
      ? {
          message: `Property 'area_size' components must be >= 0; Godot's setter clamps a negative component up to 0 (4.7.2: light_3d.cpp:724), got: Vector2(${parts.join(', ')})`,
        }
      : null,
  accepts: 'Vector2(x, y), each >= 0',
  enforced: '4.7.2: light_3d.cpp:724',
});

validatorRegistry.registerAll('AreaLight3D', {
  // 4.7.2: light_3d.cpp:764, PROPERTY_HINT_RANGE "0,4096,0.001,or_greater,exp": only the 0 floor
  // is a bound. Light3D::set_param:41 guards the param index, not the value, so it warns.
  area_range: v.nonNegativeFloat('area_range', { hinted: '4.7.2: light_3d.cpp:764' }),
  // 4.7.2: light_3d.cpp:765, PROPERTY_HINT_RANGE "-10,10,0.001,or_greater,or_less": both ends
  // are open, and a negative exponent brightens the light with distance.
  area_attenuation: v.float('area_attenuation'),
  area_size: areaSizeValidator,
  area_normalize_energy: v.boolean('area_normalize_energy'),
  // 4.7.2: light_3d.cpp:768, PROPERTY_HINT_RESOURCE_TYPE "Texture2D,-AnimatedTexture,…".
  // set_area_texture (:698-716) takes any Texture2D.
  area_texture: v.resourceReference('area_texture'),
});
