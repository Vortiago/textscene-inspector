/** Parses a MeshInstance2D: the Node2D surface plus the `mesh` and `texture` references. */

import type { ParsedHeading } from '../../../parser/utils';
import { heldResource } from '../../../godot/scene/resourceLiteral.js';
import { parseNode2D } from '../../base/node2d/parser';
import type { MeshInstance2DProperties } from './types';

export function parseMeshInstance2D(
  heading: ParsedHeading,
  properties: Record<string, string>
): MeshInstance2DProperties {
  const result: MeshInstance2DProperties = parseNode2D(heading, properties);
  result.mesh = heldResource(properties.mesh);
  result.texture = heldResource(properties.texture);
  return result;
}
