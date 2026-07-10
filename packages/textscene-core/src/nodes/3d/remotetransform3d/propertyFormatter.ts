/**
 * RemoteTransform3D property formatter — surfaces remote_path + the update
 * flags (Godot defaults when the TSCN omits them) ahead of the shared Node3D
 * transform sections.
 */

import type { PropertySection } from '../../../core/NodeRegistry';
import type { RemoteTransform3DProperties } from './types';
import { formatNode3DProperties } from '../../base/node3d/propertyFormatter';

/** `NodePath("../foo")` → `../foo`; anything else (or absent) passes through/(none). */
function extractNodePath(raw: string | undefined): string {
  if (!raw) return '(none)';
  const match = raw.match(/^NodePath\("([^"]*)"\)$/);
  return match ? match[1]! : raw;
}

export function formatRemoteTransform3DProperties(
  properties: RemoteTransform3DProperties
): PropertySection[] {
  const sections: PropertySection[] = [
    {
      title: 'RemoteTransform3D',
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

  sections.push(...formatNode3DProperties(properties));

  return sections;
}
