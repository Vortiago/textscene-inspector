/**
 * Node3D property formatter - formats transform properties for display.
 */

import type { PropertySection } from '../../../core/NodeRegistry';
import type { Node3DProperties } from './types';
import { decomposeTransform3D } from '../../../utils/transform';

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

    // Convert radians to degrees for readability
    const radToDeg = (rad: number) => ((rad * 180) / Math.PI).toFixed(2);
    sections.push({
      title: 'Rotation (degrees)',
      items: [
        { label: 'X', value: radToDeg(rotation.x) },
        { label: 'Y', value: radToDeg(rotation.y) },
        { label: 'Z', value: radToDeg(rotation.z) },
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
