/** GraphEdit parser — Control + the own members the renderer reads (`types.ts`'s own doc for why the rest are not parsed here). */

import type { ParsedHeading } from '../../../../parser/utils';
import { parseOptionalBool, parseOptionalFloat, parseOptionalInt, parseOptionalVector2 } from '../../../../parser/valueParsers';
import type { GraphEditProperties } from './types';
import { parseControl } from '../control/parser';
import { parseGraphEditConnections } from './connections';

export function parseGraphEdit(
  heading: ParsedHeading,
  properties: Record<string, string>
): GraphEditProperties {
  const result: GraphEditProperties = { ...parseControl(heading, properties), connections: [] };

  result.scrollOffset = parseOptionalVector2(properties.scroll_offset);
  result.zoom = parseOptionalFloat(properties.zoom);
  result.showGrid = parseOptionalBool(properties.show_grid);
  result.gridPattern = parseOptionalInt(properties.grid_pattern);
  result.snappingDistance = parseOptionalInt(properties.snapping_distance);
  result.connectionLinesCurvature = parseOptionalFloat(properties.connection_lines_curvature);
  result.connectionLinesThickness = parseOptionalFloat(properties.connection_lines_thickness);
  result.connections = parseGraphEditConnections(properties.connections);

  return result;
}
