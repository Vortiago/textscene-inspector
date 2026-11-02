/** HingeJoint3D parser: the Joint3D surface plus the angular limit keys. */

import type { ParsedHeading } from '../../../../parser/utils';
import { boolSlotValue, writtenScalarSlotValue } from '../../../../godot/variant/variantBool.js';
import { parseJoint3D } from '../joint3d/parser';
import type { HingeJoint3DProperties } from './types';

export function parseHingeJoint3D(
  heading: ParsedHeading,
  properties: Record<string, string>
): HingeJoint3DProperties {
  return {
    ...parseJoint3D(heading, properties),
    'angular_limit/enable': boolSlotValue(properties['angular_limit/enable']),
    'angular_limit/lower': writtenScalarSlotValue(properties['angular_limit/lower']),
    'angular_limit/upper': writtenScalarSlotValue(properties['angular_limit/upper']),
  };
}
