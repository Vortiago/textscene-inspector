/**
 * NavigationAgent3D property formatter — surfaces the avoidance/path
 * properties (Godot defaults when the TSCN omits them). Non-spatial helper
 * (extends Node), so no transform section.
 */

import type { PropertySection } from '../../../core/NodeRegistry';
import type { NavigationAgent3DProperties } from './types';

export function formatNavigationAgent3DProperties(
  properties: NavigationAgent3DProperties
): PropertySection[] {
  return [
    {
      title: 'NavigationAgent3D',
      items: [
        { label: 'Radius', value: (properties.radius ?? 0.5).toFixed(2) },
        { label: 'Height', value: (properties.height ?? 1).toFixed(2) },
        { label: 'Avoidance Enabled', value: (properties.avoidance_enabled ?? false).toString() },
        { label: 'Avoidance Layers', value: (properties.avoidance_layers ?? 1).toString() },
        { label: 'Avoidance Mask', value: (properties.avoidance_mask ?? 1).toString() },
        { label: 'Max Neighbors', value: (properties.max_neighbors ?? 10).toString() },
        { label: 'Max Speed', value: (properties.max_speed ?? 10).toFixed(2) },
        { label: 'Navigation Layers', value: (properties.navigation_layers ?? 1).toString() },
        {
          label: 'Target Desired Distance',
          value: (properties.target_desired_distance ?? 1).toFixed(2),
        },
        {
          label: 'Path Desired Distance',
          value: (properties.path_desired_distance ?? 1).toFixed(2),
        },
      ],
    },
  ];
}
