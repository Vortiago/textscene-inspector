/**
 * Decal property formatter — formats decal properties for the details panel.
 */

import type { PropertySection } from '../../../core/NodeRegistry';
import { formatNode3DProperties } from '../../base/node3d/propertyFormatter';
import type { DecalProperties } from './types';

export function formatDecalProperties(properties: DecalProperties): PropertySection[] {
  const sections: PropertySection[] = [];

  const textureItems: PropertySection['items'] = [
    { label: 'Albedo', value: properties.texture_albedo ?? '(none)' },
  ];
  if (properties.texture_normal) {
    textureItems.push({ label: 'Normal', value: properties.texture_normal });
  }
  if (properties.texture_orm) {
    textureItems.push({ label: 'ORM', value: properties.texture_orm });
  }
  if (properties.texture_emission) {
    textureItems.push({ label: 'Emission', value: properties.texture_emission });
  }
  sections.push({ title: 'Textures', items: textureItems });

  sections.push({
    title: 'Projection',
    items: [
      {
        label: 'Size',
        value: `(${properties.size.x}, ${properties.size.y}, ${properties.size.z})`,
      },
      {
        label: 'Modulate',
        value: `rgba(${(properties.modulate.r * 255).toFixed(0)}, ${(properties.modulate.g * 255).toFixed(0)}, ${(properties.modulate.b * 255).toFixed(0)}, ${properties.modulate.a.toFixed(2)})`,
      },
      { label: 'Albedo Mix', value: properties.albedo_mix.toFixed(2) },
      { label: 'Normal Fade', value: properties.normal_fade.toFixed(2) },
      { label: 'Upper Fade', value: properties.upper_fade.toFixed(2) },
      { label: 'Lower Fade', value: properties.lower_fade.toFixed(2) },
      { label: 'Cull Mask', value: `0x${properties.cull_mask.toString(16)}` },
    ],
  });

  sections.push(...formatNode3DProperties(properties));

  return sections;
}
