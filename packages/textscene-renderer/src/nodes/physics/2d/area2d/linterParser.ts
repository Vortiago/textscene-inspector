/**
 * Area2D strict validators for linting
 *
 * Registers property validators that check format and value constraints.
 */

import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import {
  createBooleanValidator,
  createVector2Validator,
  createNumericRangeValidator,
  createSpaceOverrideValidator,
  createCollisionLayerValidator,
  createCollisionMaskValidator,
  createDisableModeValidator,
  createStringValidator,
} from '../../../../linting/validators/index.js';

validatorRegistry.registerAll('Area2D', {
  'monitoring': createBooleanValidator('monitoring', 'INVALID_MONITORING_FORMAT'),
  'monitorable': createBooleanValidator('monitorable', 'INVALID_MONITORABLE_FORMAT'),

  'space_override': createSpaceOverrideValidator('space_override', 'INVALID_SPACE_OVERRIDE_FORMAT', 'INVALID_SPACE_OVERRIDE_VALUE'),
  'gravity_space_override': createSpaceOverrideValidator('gravity_space_override', 'INVALID_GRAVITY_SPACE_OVERRIDE_FORMAT', 'INVALID_GRAVITY_SPACE_OVERRIDE_VALUE'),
  'gravity_point': createBooleanValidator('gravity_point', 'INVALID_GRAVITY_POINT_FORMAT'),
  'gravity_point_center': createVector2Validator('gravity_point_center', 'INVALID_GRAVITY_POINT_CENTER_FORMAT'),

  'gravity_point_unit_distance': createNumericRangeValidator(
    'gravity_point_unit_distance',
    0.0001,
    null,
    false,
    'Property \'gravity_point_unit_distance\' must be greater than 0. This distance is required for point gravity calculations.',
    'INVALID_GRAVITY_POINT_UNIT_DISTANCE_FORMAT',
    'INVALID_GRAVITY_POINT_UNIT_DISTANCE_VALUE'
  ),
  'gravity_direction': createVector2Validator('gravity_direction', 'INVALID_GRAVITY_DIRECTION_FORMAT'),
  'gravity': createNumericRangeValidator('gravity', null, null, false, undefined, 'INVALID_GRAVITY_FORMAT'),
  'linear_damp_space_override': createSpaceOverrideValidator('linear_damp_space_override', 'INVALID_LINEAR_DAMP_SPACE_OVERRIDE_FORMAT', 'INVALID_LINEAR_DAMP_SPACE_OVERRIDE_VALUE'),
  'linear_damp': createNumericRangeValidator('linear_damp', 0, null, false, 'Property \'linear_damp\' must be >= 0. Damping cannot be negative.', 'INVALID_LINEAR_DAMP_FORMAT', 'INVALID_LINEAR_DAMP_VALUE'),
  'angular_damp_space_override': createSpaceOverrideValidator('angular_damp_space_override', 'INVALID_ANGULAR_DAMP_SPACE_OVERRIDE_FORMAT', 'INVALID_ANGULAR_DAMP_SPACE_OVERRIDE_VALUE'),
  'angular_damp': createNumericRangeValidator('angular_damp', 0, null, false, 'Property \'angular_damp\' must be >= 0. Damping cannot be negative.', 'INVALID_ANGULAR_DAMP_FORMAT', 'INVALID_ANGULAR_DAMP_VALUE'),
  'priority': createNumericRangeValidator('priority', null, null, false, undefined, 'INVALID_PRIORITY_FORMAT'),
  'audio_bus_override': createBooleanValidator('audio_bus_override', 'INVALID_AUDIO_BUS_OVERRIDE_FORMAT'),
  'audio_bus_name': createStringValidator('audio_bus_name', 'INVALID_AUDIO_BUS_NAME_FORMAT'),
  'collision_layer': createCollisionLayerValidator(),
  'collision_mask': createCollisionMaskValidator(),
  'disable_mode': createDisableModeValidator(),
});
