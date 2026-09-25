/**
 * SpotLight3D strict validators. The base-walk SpotLight3D → Light3D → Node3D
 * delivers the light_* and shadow_* validators.
 */

import '../shared/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import { v } from '../../../../linter/validators/index.js';

validatorRegistry.registerAll('SpotLight3D', {
  // light_3d.cpp:672, PROPERTY_HINT_RANGE "0,4096,0.001,or_greater,exp,suffix:m":
  // `or_greater` opens the ceiling, `exp` is slider scaling and `suffix:` a
  // unit, so only the 0 floor is a bound. Light3D::set_param:36 guards the
  // param index, not the value, so it warns.
  spot_range: v.nonNegativeFloat('spot_range', { hinted: 'light_3d.cpp:672' }),
  // light_3d.cpp:673, PROPERTY_HINT_RANGE "-10,10,0.01,or_greater,or_less":
  // negative is legal and means an inverse falloff curve.
  spot_attenuation: v.float('spot_attenuation'),
  // light_3d.cpp:674, PROPERTY_HINT_RANGE "0,180,0.01,degrees", both ends closed.
  // The bare "degrees" token is a display suffix, not "radians_as_degrees", so
  // the bound applies unconverted. Light3D::set_param:36 guards the param index,
  // not the value, so both ends warn.
  spot_angle: v.float('spot_angle', { min: 0, max: 180, hinted: 'light_3d.cpp:674' }),
  // light_3d.cpp:675, PROPERTY_HINT_EXP_EASING: no range is stated, so no bound.
  spot_angle_attenuation: v.float('spot_angle_attenuation'),
});
