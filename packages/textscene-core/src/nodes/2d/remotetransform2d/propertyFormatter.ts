/**
 * RemoteTransform2D property formatter — surfaces remote_path + the update
 * flags (Godot defaults when the TSCN omits them) ahead of the shared Node2D
 * transform sections.
 */

import type { PropertySection } from '../../../core/NodeRegistry';
import type { RemoteTransform2DProperties } from './types';
import { formatNode2DProperties } from '../../base/node2d/propertyFormatter';

/** `NodePath("../foo")` → `../foo`; anything else (or absent) passes through/(none). */
function extractNodePath(raw: string | undefined): string {
  if (!raw) return '(none)';
  const match = raw.match(/^NodePath\("([^"]*)"\)$/);
  return match ? match[1]! : raw;
}

export function formatRemoteTransform2DProperties(
  properties: RemoteTransform2DProperties
): PropertySection[] {
  const sections: PropertySection[] = [
    {
      title: 'RemoteTransform2D',
      items: [
        { label: 'Remote Path', value: extractNodePath(properties.remote_path) },
        { label: 'Update Position', value: (properties.update_position ?? true).toString() },
        { label: 'Update Rotation', value: (properties.update_rotation ?? true).toString() },
        { label: 'Update Scale', value: (properties.update_scale ?? true).toString() },
        {
          label: 'Use Global Coordinates',
          value: (properties.use_global_coordinates ?? true).toString(),
        },
      ],
    },
  ];

  sections.push(...formatNode2DProperties(properties));

  return sections;
}
