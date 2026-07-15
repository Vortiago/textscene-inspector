/**
 * DirectionalLight3D strict validators for linting.
 * Migrated to the declarative `v` namespace.
 *
 * Light3D base validators (light_* / shadow_*) are inherited via the
 * base-walk: DirectionalLight3D → Light3D → Node3D.
 */

import '../shared/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import { v } from '../../../../linter/validators/index.js';

const DIRECTIONAL_SHADOW_MODE = {
  0: 'ORTHOGONAL',
  1: 'PARALLEL_2_SPLITS',
  2: 'PARALLEL_4_SPLITS',
};

const SKY_MODE = { 0: 'LIGHT_AND_SKY', 1: 'LIGHT_ONLY', 2: 'SKY_ONLY' };

validatorRegistry.registerAll('DirectionalLight3D', {
  directional_shadow_mode: v.enumInt(
    'directional_shadow_mode',
    0,
    2,
    DIRECTIONAL_SHADOW_MODE
  ),
  directional_shadow_split_1: v.float('directional_shadow_split_1', { min: 0, max: 1 }),
  directional_shadow_split_2: v.float('directional_shadow_split_2', { min: 0, max: 1 }),
  directional_shadow_split_3: v.float('directional_shadow_split_3', { min: 0, max: 1 }),
  directional_shadow_fade_start: v.float('directional_shadow_fade_start', {
    min: 0,
    max: 1,
  }),
  directional_shadow_max_distance: v.nonNegativeFloat('directional_shadow_max_distance'),
  directional_shadow_pancake_size: v.nonNegativeFloat('directional_shadow_pancake_size'),
  directional_shadow_blend_splits: v.boolean('directional_shadow_blend_splits'),
  sky_mode: v.enumInt('sky_mode', 0, 2, SKY_MODE),
});
