/** Generic6DOFJoint3D parser: the Joint3D surface plus the linear and angular limit keys of each axis. */

import type { ParsedHeading } from '../../../../parser/utils';
import { boolSlotValue, writtenScalarSlotValue } from '../../../../godot/variant/variantBool.js';
import { parseJoint3D } from '../joint3d/parser';
import type { Generic6DOFJoint3DProperties } from './types';

export function parseGeneric6DOFJoint3D(
  heading: ParsedHeading,
  properties: Record<string, string>
): Generic6DOFJoint3DProperties {
  return {
    ...parseJoint3D(heading, properties),
    'linear_limit_x/enabled': boolSlotValue(properties['linear_limit_x/enabled']),
    'linear_limit_x/upper_distance': writtenScalarSlotValue(properties['linear_limit_x/upper_distance']),
    'linear_limit_x/lower_distance': writtenScalarSlotValue(properties['linear_limit_x/lower_distance']),
    'angular_limit_x/enabled': boolSlotValue(properties['angular_limit_x/enabled']),
    'angular_limit_x/upper_angle': writtenScalarSlotValue(properties['angular_limit_x/upper_angle']),
    'angular_limit_x/lower_angle': writtenScalarSlotValue(properties['angular_limit_x/lower_angle']),
    'linear_limit_y/enabled': boolSlotValue(properties['linear_limit_y/enabled']),
    'linear_limit_y/upper_distance': writtenScalarSlotValue(properties['linear_limit_y/upper_distance']),
    'linear_limit_y/lower_distance': writtenScalarSlotValue(properties['linear_limit_y/lower_distance']),
    'angular_limit_y/enabled': boolSlotValue(properties['angular_limit_y/enabled']),
    'angular_limit_y/upper_angle': writtenScalarSlotValue(properties['angular_limit_y/upper_angle']),
    'angular_limit_y/lower_angle': writtenScalarSlotValue(properties['angular_limit_y/lower_angle']),
    'linear_limit_z/enabled': boolSlotValue(properties['linear_limit_z/enabled']),
    'linear_limit_z/upper_distance': writtenScalarSlotValue(properties['linear_limit_z/upper_distance']),
    'linear_limit_z/lower_distance': writtenScalarSlotValue(properties['linear_limit_z/lower_distance']),
    'angular_limit_z/enabled': boolSlotValue(properties['angular_limit_z/enabled']),
    'angular_limit_z/upper_angle': writtenScalarSlotValue(properties['angular_limit_z/upper_angle']),
    'angular_limit_z/lower_angle': writtenScalarSlotValue(properties['angular_limit_z/lower_angle']),
  };
}
