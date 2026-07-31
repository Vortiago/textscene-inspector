/**
 * Area2D strict validators for linting.
 * Migrated to the declarative `v` namespace.
 *
 * Uses the specialized `createSpaceOverride`, `createCollisionLayer`,
 * `createCollisionMask`, and `createDisableMode` helpers from
 * `linter/validators/physicsValidators.ts` for the properties they
 * were purpose-built for; everything else goes through the `v` namespace.
 */

import '../../shared/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import {
  v,
  createSpaceOverrideValidator,
} from '../../../../linter/validators/index.js';

validatorRegistry.registerAll('Area2D', {
  monitoring: v.boolean('monitoring'),
  monitorable: v.boolean('monitorable'),

  space_override: createSpaceOverrideValidator(
    'space_override',
    'INVALID_SPACE_OVERRIDE_FORMAT',
    'INVALID_SPACE_OVERRIDE_VALUE'
  ),
  gravity_space_override: createSpaceOverrideValidator(
    'gravity_space_override',
    'INVALID_GRAVITY_SPACE_OVERRIDE_FORMAT',
    'INVALID_GRAVITY_SPACE_OVERRIDE_VALUE'
  ),
  gravity_point: v.boolean('gravity_point'),
  gravity_point_center: v.vector2('gravity_point_center'),
  gravity_point_unit_distance: v.float('gravity_point_unit_distance', {
    min: 0.0001,
    message:
      "Property 'gravity_point_unit_distance' must be greater than 0. This distance is required for point gravity calculations.",
  }),
  gravity_direction: v.vector2('gravity_direction'),
  gravity: v.float('gravity'),
  linear_damp_space_override: createSpaceOverrideValidator(
    'linear_damp_space_override',
    'INVALID_LINEAR_DAMP_SPACE_OVERRIDE_FORMAT',
    'INVALID_LINEAR_DAMP_SPACE_OVERRIDE_VALUE'
  ),
  linear_damp: v.float('linear_damp', {
    min: 0,
    message: "Property 'linear_damp' must be >= 0. Damping cannot be negative.",
  }),
  angular_damp_space_override: createSpaceOverrideValidator(
    'angular_damp_space_override',
    'INVALID_ANGULAR_DAMP_SPACE_OVERRIDE_FORMAT',
    'INVALID_ANGULAR_DAMP_SPACE_OVERRIDE_VALUE'
  ),
  angular_damp: v.float('angular_damp', {
    min: 0,
    message: "Property 'angular_damp' must be >= 0. Damping cannot be negative.",
  }),
  priority: v.float('priority'),
  audio_bus_override: v.boolean('audio_bus_override'),
  audio_bus_name: v.string('audio_bus_name'),
});
