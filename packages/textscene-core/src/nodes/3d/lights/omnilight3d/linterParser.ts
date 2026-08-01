/**
 * OmniLight3D strict validators for linting.
 * Migrated to the declarative `v` namespace.
 *
 * Light3D base validators (light_* / shadow_*) are inherited via the
 * base-walk: OmniLight3D → Light3D → Node3D.
 */

import '../shared/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import { v } from '../../../../linter/validators/index.js';

const OMNI_SHADOW_MODE = { 0: 'DUAL_PARABOLOID', 1: 'CUBE' };

validatorRegistry.registerAll('OmniLight3D', {
  omni_range: v.positiveFloat('omni_range'),
  // light_3d.cpp:640, PROPERTY_HINT_RANGE "-10,10,0.001,or_greater,or_less":
  // the range starts below zero and both ends are soft, so a negative is legal
  // and means an inverse falloff curve.
  omni_attenuation: v.float('omni_attenuation'),
  omni_shadow_mode: v.enumInt('omni_shadow_mode', 0, 1, OMNI_SHADOW_MODE),
});
