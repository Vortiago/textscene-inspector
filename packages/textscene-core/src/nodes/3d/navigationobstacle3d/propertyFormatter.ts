/**
 * NavigationObstacle3D property formatter — surfaces radius/height/avoidance
 * properties (Godot defaults when the TSCN omits them) ahead of the shared
 * Node3D transform sections.
 */

import type { PropertySection } from '../../../core/NodeRegistry';
import type { NavigationObstacle3DProperties } from './types';
import { formatNode3DProperties } from '../../base/node3d/propertyFormatter';

export function formatNavigationObstacle3DProperties(
  properties: NavigationObstacle3DProperties
): PropertySection[] {
  const sections: PropertySection[] = [
    {
      title: 'NavigationObstacle3D',
      items: [
        { label: 'Radius', value: (properties.radius ?? 0).toFixed(2) },
        { label: 'Height', value: (properties.height ?? 1).toFixed(2) },
        { label: 'Avoidance Enabled', value: (properties.avoidance_enabled ?? true).toString() },
        { label: 'Avoidance Layers', value: (properties.avoidance_layers ?? 1).toString() },
        {
          label: 'Affect Navigation Mesh',
          value: (properties.affect_navigation_mesh ?? false).toString(),
        },
        {
          label: 'Carve Navigation Mesh',
          value: (properties.carve_navigation_mesh ?? false).toString(),
        },
        { label: 'Use 3D Avoidance', value: (properties.use_3d_avoidance ?? false).toString() },
      ],
    },
  ];

  sections.push(...formatNode3DProperties(properties));

  return sections;
}
