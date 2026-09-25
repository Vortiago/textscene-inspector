/** Parses a NavigationRegion2D: Node2D plus the navigation_polygon reference. */

import type { ParsedHeading } from '../../../parser/utils';
import { parseNode2D } from '../../base/node2d/parser';
import type { NavigationRegion2DProperties } from './types';

export function parseNavigationRegion2D(
  heading: ParsedHeading,
  properties: Record<string, string>
): NavigationRegion2DProperties {
  const baseProperties = parseNode2D(heading, properties);
  return {
    ...baseProperties,
    navigationPolygon: properties.navigation_polygon,
  };
}
