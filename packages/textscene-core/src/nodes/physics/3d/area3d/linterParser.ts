/**
 * Area3D strict validators for linting.
 * Migrated to the declarative `v` namespace.
 */

import '../../shared/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import { v } from '../../../../linter/validators/index.js';

const SPACE_OVERRIDE = {
  0: 'DISABLED',
  1: 'COMBINE',
  2: 'COMBINE_REPLACE',
  3: 'REPLACE',
  4: 'REPLACE_COMBINE',
};

validatorRegistry.registerAll('Area3D', {
  monitoring: v.boolean('monitoring'),
  monitorable: v.boolean('monitorable'),
  space_override: v.enumInt('space_override', 0, 4, SPACE_OVERRIDE),
  gravity_space_override: v.enumInt('gravity_space_override', 0, 4, SPACE_OVERRIDE),
  gravity_point: v.boolean('gravity_point'),
  gravity_point_center: v.vector3('gravity_point_center'),
  gravity_point_unit_distance: v.float('gravity_point_unit_distance', {
    min: Number.MIN_VALUE,
    message:
      "Property 'gravity_point_unit_distance' must be greater than 0. This distance is required for point gravity calculations.",
  }),
  gravity_direction: v.vector3('gravity_direction'),
  gravity: v.float('gravity'),
  linear_damp_space_override: v.enumInt(
    'linear_damp_space_override',
    0,
    4,
    SPACE_OVERRIDE
  ),
  linear_damp: v.float('linear_damp', {
    min: 0,
    message: "Property 'linear_damp' must be >= 0. Damping cannot be negative.",
  }),
  angular_damp_space_override: v.enumInt(
    'angular_damp_space_override',
    0,
    4,
    SPACE_OVERRIDE
  ),
  angular_damp: v.float('angular_damp', {
    min: 0,
    message: "Property 'angular_damp' must be >= 0. Damping cannot be negative.",
  }),
  priority: v.float('priority'),
  audio_bus_override: v.boolean('audio_bus_override'),
  audio_bus_name: v.string('audio_bus_name'),
});
