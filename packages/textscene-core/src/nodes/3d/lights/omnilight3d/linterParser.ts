/**
 * OmniLight3D strict validators. The base-walk OmniLight3D → Light3D → Node3D
 * delivers the light_* and shadow_* validators.
 */

import '../shared/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import { v } from '../../../../linter/validators/index.js';
import { OMNI_LIGHT_3D_SHADOW_MODE_NAMES } from '../../../../godot/scene/light.js';

validatorRegistry.registerAll('OmniLight3D', {
  // light_3d.cpp:639, PROPERTY_HINT_RANGE "0,4096,0.001,or_greater,exp":
  // `or_greater` opens the ceiling and `exp` is slider scaling, so only the 0
  // floor is a bound. Light3D::set_param:36 guards the param index, not the
  // value, so it warns.
  omni_range: v.nonNegativeFloat('omni_range', { hinted: 'light_3d.cpp:639' }),
  // light_3d.cpp:640, PROPERTY_HINT_RANGE "-10,10,0.001,or_greater,or_less":
  // the range starts below zero and both ends are soft, so a negative is legal
  // and means an inverse falloff curve.
  omni_attenuation: v.float('omni_attenuation'),
  omni_shadow_mode: v.enumInt('omni_shadow_mode', OMNI_LIGHT_3D_SHADOW_MODE_NAMES, {
    hinted: 'light_3d.cpp:641',
  }),
});
