/**
 * SpotLight3D strict validators for linting.
 * Migrated to the declarative `v` namespace (WI-ARCH-1).
 */

import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import { v } from '../../../../linter/validators/index.js';
import { SHARED_LIGHT_VALIDATORS } from '../shared/linterParser.js';

validatorRegistry.registerAll('SpotLight3D', {
  ...SHARED_LIGHT_VALIDATORS,
  spot_range: v.positiveFloat('spot_range'),
  spot_attenuation: v.nonNegativeFloat('spot_attenuation'),
  // Custom message keeps the "degrees" qualifier the per-node test asserts.
  spot_angle: v.float('spot_angle', {
    min: 0,
    max: 90,
    message: "Property 'spot_angle' must be between 0 and 90 degrees",
  }),
  spot_angle_attenuation: v.nonNegativeFloat('spot_angle_attenuation'),
});
