/**
 * SpotLight3D strict validators for linting.
 * Migrated to the declarative `v` namespace.
 *
 * Light3D base validators (light_* / shadow_*) are inherited via the
 * base-walk: SpotLight3D → Light3D → Node3D.
 */

import '../shared/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import { v } from '../../../../linter/validators/index.js';

validatorRegistry.registerAll('SpotLight3D', {
  // light_3d.cpp:672, PROPERTY_HINT_RANGE "0,4096,0.001,or_greater". Light3D::set_param:36
  // guards the param index, not the value, so out-of-hint is the advisory's job.
  spot_range: v.float('spot_range'),
  // light_3d.cpp:673, PROPERTY_HINT_RANGE "-10,10,0.01,or_greater,or_less":
  // negative is legal and means an inverse falloff curve.
  spot_attenuation: v.float('spot_attenuation'),
  // light_3d.cpp:674, PROPERTY_HINT_RANGE "0,180,0.01,degrees" — and unenforced,
  // so 0-180 is the `spotlight3d-spot-angle-out-of-range` warning, not an error.
  spot_angle: v.float('spot_angle'),
  // light_3d.cpp:675, PROPERTY_HINT_EXP_EASING: no range is stated, so no bound.
  spot_angle_attenuation: v.float('spot_angle_attenuation'),
});
