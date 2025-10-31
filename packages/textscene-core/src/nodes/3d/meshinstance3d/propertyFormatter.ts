/**
 * MeshInstance3D property formatter - formats mesh and material properties for display.
 */

import type { PropertySection } from '../../../core/NodeRegistry';
import type { MeshInstance3DProperties } from './types';
import { formatNode3DProperties } from '../../base/node3d/propertyFormatter';

export function formatMeshInstance3DProperties(properties: MeshInstance3DProperties): PropertySection[] {
  const sections: PropertySection[] = [];
  const meshItems: PropertySection['items'] = [];

  if (properties.mesh) {
    meshItems.push({ label: 'Mesh', value: properties.mesh });
  }

  if (properties.castShadow !== undefined) {
    const shadowLabels = ['OFF', 'ON', 'DOUBLE_SIDED', 'SHADOWS_ONLY'];
    meshItems.push({
      label: 'Cast Shadow',
      value: shadowLabels[properties.castShadow] || `Unknown (${properties.castShadow})`,
    });
  }

  if (properties.skeleton) {
    meshItems.push({ label: 'Skeleton', value: properties.skeleton });
  }

  if (properties.skin) {
    meshItems.push({ label: 'Skin', value: properties.skin });
  }

  if (meshItems.length > 0) {
    sections.push({
      title: 'Mesh',
      items: meshItems,
    });
  }

  if (properties.surfaceMaterialOverrides.size > 0) {
    const materialItems = Array.from(properties.surfaceMaterialOverrides.entries()).map(
      ([index, material]) => ({
        label: `Surface ${index}`,
        value: material,
      })
    );

    sections.push({
      title: 'Material Overrides',
      items: materialItems,
    });
  }

  // Include inherited Node3D transform properties
  sections.push(...formatNode3DProperties(properties));

  return sections;
}
