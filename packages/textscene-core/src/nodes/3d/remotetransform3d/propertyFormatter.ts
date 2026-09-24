/**
 * RemoteTransform3D property formatter: remote_path and the update flags (Godot defaults when the
 * TSCN omits them), ahead of the shared Node3D transform sections.
 */

import type { PropertySection } from '../../../core/NodeRegistry';
import type { RemoteTransform3DProperties } from './types';
import { formatNode3DProperties } from '../../base/node3d/propertyFormatter';
import { parseNodePathLiteral } from '../../../parser/valueParsers';

/** `NodePath("../foo")` → `../foo`. Anything else passes through, and absent gives (none). */
function displayNodePath(raw: string | undefined): string {
  return raw ? (parseNodePathLiteral(raw) ?? raw) : '(none)';
}

export function formatRemoteTransform3DProperties(
  properties: RemoteTransform3DProperties
): PropertySection[] {
  const sections: PropertySection[] = [
    {
      title: 'RemoteTransform3D',
      items: [
        { label: 'Remote Path', value: displayNodePath(properties.remote_path) },
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
