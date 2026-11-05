/** Parses a MultiMeshInstance2D: the Node2D surface plus the `multimesh` and `texture` references. */

import type { ParsedHeading } from '../../../parser/utils';
import { heldResource } from '../../../godot/scene/resourceLiteral';
import { parseNode2D } from '../../base/node2d/parser';
import type { MultiMeshInstance2DProperties } from './types';

export function parseMultiMeshInstance2D(
  heading: ParsedHeading,
  properties: Record<string, string>
): MultiMeshInstance2DProperties {
  const result: MultiMeshInstance2DProperties = parseNode2D(heading, properties);
  result.multimesh = heldResource(properties.multimesh);
  result.texture = heldResource(properties.texture);
  return result;
}
