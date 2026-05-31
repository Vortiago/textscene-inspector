/**
 * OmniLight3D strict validators for linting.
 * Migrated to the declarative `v` namespace (WI-ARCH-1).
 */

import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import { v } from '../../../../linter/validators/index.js';
import { SHARED_LIGHT_VALIDATORS } from '../shared/linterParser.js';

const OMNI_SHADOW_MODE = { 0: 'DUAL_PARABOLOID', 1: 'CUBE' };

validatorRegistry.registerAll('OmniLight3D', {
  ...SHARED_LIGHT_VALIDATORS,
  omni_range: v.positiveFloat('omni_range'),
  omni_attenuation: v.nonNegativeFloat('omni_attenuation'),
  omni_shadow_mode: v.enumInt('omni_shadow_mode', 0, 1, OMNI_SHADOW_MODE),
});
