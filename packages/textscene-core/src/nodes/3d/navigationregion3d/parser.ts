/**
 * NavigationRegion3D parser: Node3D plus the navigation_mesh reference.
 */

import type { ParsedHeading } from '../../../parser/utils';
import { parseNode3D } from '../../base/node3d/parser';
import type { NavigationRegion3DProperties } from './types';

export function parseNavigationRegion3D(
  heading: ParsedHeading,
  properties: Record<string, string>
): NavigationRegion3DProperties {
  const baseProperties = parseNode3D(heading, properties);
  return {
    ...baseProperties,
    navigationMesh: properties.navigation_mesh,
  };
}
