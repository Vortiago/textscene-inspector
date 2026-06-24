/**
 * Path3D parser — the Node3D transform surface plus the raw `curve` resource
 * reference (the Curve3D is resolved + tessellated in the component).
 */

import type { ParsedHeading } from '../../../parser/utils';
import { parseNode3D } from '../../base/node3d/parser';
import type { Path3DProperties } from './types';

export function parsePath3D(
  heading: ParsedHeading,
  properties: Record<string, string>
): Path3DProperties {
  const base = parseNode3D(heading, properties);
  const result: Path3DProperties = { ...base };
  if (properties.curve) result.curve = properties.curve;
  return result;
}
