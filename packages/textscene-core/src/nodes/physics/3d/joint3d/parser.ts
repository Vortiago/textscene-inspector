/** Joint3D parser: the Node3D transform surface plus `node_a` and `node_b`. */

import type { ParsedHeading } from '../../../../parser/utils';
import { parseNodePathLiteral } from '../../../../parser/valueParsers';
import { parseNode3D } from '../../../base/node3d/parser';
import type { Joint3DProperties } from './types';

export function parseJoint3D(heading: ParsedHeading, properties: Record<string, string>): Joint3DProperties {
  return {
    ...parseNode3D(heading, properties),
    node_a: parseNodePathLiteral(properties.node_a) || undefined,
    node_b: parseNodePathLiteral(properties.node_b) || undefined,
  };
}
