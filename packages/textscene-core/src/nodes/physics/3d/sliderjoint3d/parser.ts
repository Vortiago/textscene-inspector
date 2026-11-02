/** SliderJoint3D parser: the Joint3D surface plus the linear and angular limit keys. */

import type { ParsedHeading } from '../../../../parser/utils';
import { writtenScalarSlotValue } from '../../../../godot/variant/variantBool.js';
import { parseJoint3D } from '../joint3d/parser';
import type { SliderJoint3DProperties } from './types';

export function parseSliderJoint3D(
  heading: ParsedHeading,
  properties: Record<string, string>
): SliderJoint3DProperties {
  return {
    ...parseJoint3D(heading, properties),
    'linear_limit/upper_distance': writtenScalarSlotValue(properties['linear_limit/upper_distance']),
    'linear_limit/lower_distance': writtenScalarSlotValue(properties['linear_limit/lower_distance']),
    'angular_limit/upper_angle': writtenScalarSlotValue(properties['angular_limit/upper_angle']),
    'angular_limit/lower_angle': writtenScalarSlotValue(properties['angular_limit/lower_angle']),
  };
}
