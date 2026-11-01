/** ConeTwistJoint3D parser: the Joint3D surface plus `swing_span` and `twist_span`. */

import type { ParsedHeading } from '../../../../parser/utils';
import { writtenScalarSlotValue } from '../../../../godot/variant/variantBool.js';
import { parseJoint3D } from '../joint3d/parser';
import type { ConeTwistJoint3DProperties } from './types';

export function parseConeTwistJoint3D(
  heading: ParsedHeading,
  properties: Record<string, string>
): ConeTwistJoint3DProperties {
  return {
    ...parseJoint3D(heading, properties),
    swing_span: writtenScalarSlotValue(properties.swing_span),
    twist_span: writtenScalarSlotValue(properties.twist_span),
  };
}
