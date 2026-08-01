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
  spot_range: v.positiveFloat('spot_range'),
  // light_3d.cpp:673, PROPERTY_HINT_RANGE "-10,10,0.01,or_greater,or_less":
  // negative is legal and means an inverse falloff curve.
  spot_attenuation: v.float('spot_attenuation'),
  // Custom message keeps the "degrees" qualifier the per-node test asserts.
  spot_angle: v.float('spot_angle', {
    min: 0,
    max: 90,
    message: "Property 'spot_angle' must be between 0 and 90 degrees",
  }),
  spot_angle_attenuation: v.nonNegativeFloat('spot_angle_attenuation'),
});
