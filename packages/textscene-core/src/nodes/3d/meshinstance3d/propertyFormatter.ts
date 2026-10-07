/** Formats a MeshInstance3D's mesh and material properties for display. */

import type { PropertySection } from '../../../core/NodeRegistry';
import type { MeshInstance3DProperties } from './types';
import { formatNode3DProperties } from '../../base/node3d/propertyFormatter';
import { SHADOW_CASTING_SETTING_NAMES } from '../../../godot/rendering';

export function formatMeshInstance3DProperties(properties: MeshInstance3DProperties): PropertySection[] {
  const sections: PropertySection[] = [];
  const meshItems: PropertySection['items'] = [];

  if (properties.mesh) {
    meshItems.push({ label: 'Mesh', value: properties.mesh });
  }

  meshItems.push({
    label: 'Cast Shadow',
    value: SHADOW_CASTING_SETTING_NAMES[properties.castShadow] ?? `Unknown (${properties.castShadow})`,
  });

  if (properties.skeleton) {
    meshItems.push({ label: 'Skeleton', value: properties.skeleton });
  }

  if (properties.skin) {
    meshItems.push({ label: 'Skin', value: properties.skin });
  }

  sections.push({ title: 'Mesh', items: meshItems });

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

  sections.push(...formatNode3DProperties(properties));

  return sections;
}
