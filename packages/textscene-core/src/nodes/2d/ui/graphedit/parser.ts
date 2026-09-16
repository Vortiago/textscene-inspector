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
  result.snappingEnabled = parseOptionalBool(properties.snapping_enabled);
  result.minimapEnabled = parseOptionalBool(properties.minimap_enabled);
  result.minimapSize = parseOptionalVector2(properties.minimap_size);
  result.minimapOpacity = parseOptionalFloat(properties.minimap_opacity);
  result.showMenu = parseOptionalBool(properties.show_menu);
  result.showZoomLabel = parseOptionalBool(properties.show_zoom_label);
  result.showZoomButtons = parseOptionalBool(properties.show_zoom_buttons);
  result.showGridButtons = parseOptionalBool(properties.show_grid_buttons);
  result.showMinimapButton = parseOptionalBool(properties.show_minimap_button);
  result.showArrangeButton = parseOptionalBool(properties.show_arrange_button);

  return result;
}
