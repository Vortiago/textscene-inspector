/**
 * PointLight2D strict validators for linting.
 * Migrated to the declarative `v` namespace.
 */

import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { v } from '../../../linter/validators/index.js';

validatorRegistry.registerAll('PointLight2D', {
  blend_mode: v.enumInt('blend_mode', 0, 2, { 0: 'ADD', 1: 'SUB', 2: 'MIX' }),
  color: v.color('color'),
  enabled: v.boolean('enabled'),
  energy: v.nonNegativeFloat('energy'),
  offset: v.vector2('offset'),
  texture: v.resourceReference('texture'),
  texture_scale: v.nonNegativeFloat('texture_scale'),
});
