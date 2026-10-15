/**
 * Node3D property formatter - formats transform properties for display.
 */

import type { PropertySection } from '../../../core/NodeRegistry';
import type { Node3DProperties } from './types';
import { radToDeg } from '../../../godot/math/math.js';
import { decomposeTransform3D } from '../../../utils/transform';

const formatDegrees = (radians: number) => radToDeg(radians).toFixed(2);

export function formatNode3DProperties(properties: Node3DProperties): PropertySection[] {
  const sections: PropertySection[] = [];

  if (properties.transform) {
    const { position, rotation, scale } = decomposeTransform3D(properties.transform);

    sections.push({
      title: 'Position',
      items: [
        { label: 'X', value: position.x.toFixed(3) },
        { label: 'Y', value: position.y.toFixed(3) },
        { label: 'Z', value: position.z.toFixed(3) },
      ],
    });

    sections.push({
      title: 'Rotation (degrees)',
      items: [
        { label: 'X', value: formatDegrees(rotation.x) },
        { label: 'Y', value: formatDegrees(rotation.y) },
        { label: 'Z', value: formatDegrees(rotation.z) },
      ],
    });

    sections.push({
      title: 'Scale',
      items: [
        { label: 'X', value: scale.x.toFixed(3) },
        { label: 'Y', value: scale.y.toFixed(3) },
        { label: 'Z', value: scale.z.toFixed(3) },
      ],
    });
  }

  if (properties.instance) {
    sections.push({
      title: 'Instance',
      items: [{ label: 'Scene', value: properties.instance }],
    });
  }

  return sections;
}
