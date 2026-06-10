/**
 * Sprite2D property formatter — formats sprite properties for the
 * details panel. Mirrors the Sprite3D formatter for the 2D surface.
 */

import type { PropertySection } from '../../../core/NodeRegistry';
import type { Sprite2DProperties } from './types';
import { formatNode2DProperties } from '../../base/node2d/propertyFormatter';

export function formatSprite2DProperties(properties: Sprite2DProperties): PropertySection[] {
  const sections: PropertySection[] = [];

  const textureItems: PropertySection['items'] = [
    { label: 'Texture', value: properties.texture ?? '(none)' },
    { label: 'Centered', value: properties.centered ? 'Yes' : 'No' },
    { label: 'Offset', value: `(${properties.offset.x}, ${properties.offset.y})` },
  ];
  if (properties.flip_h) textureItems.push({ label: 'Flip H', value: 'Yes' });
  if (properties.flip_v) textureItems.push({ label: 'Flip V', value: 'Yes' });
  sections.push({ title: 'Texture', items: textureItems });

  if (properties.hframes > 1 || properties.vframes > 1 || properties.frame > 0) {
    const sheetItems: PropertySection['items'] = [
      { label: 'HFrames', value: properties.hframes.toString() },
      { label: 'VFrames', value: properties.vframes.toString() },
      { label: 'Frame', value: properties.frame.toString() },
    ];
    if (properties.frame_coords) {
      sheetItems.push({
        label: 'Frame Coords',
        value: `(${properties.frame_coords.x}, ${properties.frame_coords.y})`,
      });
    }
    sections.push({ title: 'Sprite Sheet', items: sheetItems });
  }

  if (properties.region_enabled && properties.region_rect) {
    const r = properties.region_rect;
    sections.push({
      title: 'Region',
      items: [
        { label: 'Enabled', value: 'true' },
        { label: 'Rect', value: `(${r.x}, ${r.y}, ${r.width}, ${r.height})` },
      ],
    });
  }

  sections.push(...formatNode2DProperties(properties));

  return sections;
}
