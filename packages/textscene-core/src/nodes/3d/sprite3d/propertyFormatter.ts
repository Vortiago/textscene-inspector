/** Sprite3D property formatter: formats sprite properties for the details panel. */

import type { PropertySection } from '../../../core/NodeRegistry';
import { VECTOR3_AXIS_NAMES } from '../../../godot/math/vector3Axis';
import { type Sprite3DProperties } from './types';
import { formatColorRgba } from '../../../utils/colorParser';
import { formatNode3DProperties } from '../../base/node3d/propertyFormatter';
import { AlphaCutMode } from '../../../godot/rendering/materials/alphaCut';
import { BillboardMode } from '../../../godot/scene/billboard';

export function formatSprite3DProperties(properties: Sprite3DProperties): PropertySection[] {
  const sections: PropertySection[] = [];

  const textureItems: PropertySection['items'] = [
    { label: 'Texture', value: properties.texture ?? '(none)' },
    { label: 'Pixel Size', value: properties.pixel_size.toFixed(4) },
    { label: 'Billboard', value: billboardName(properties.billboard) },
  ];
  if (properties.billboard === BillboardMode.BILLBOARD_FIXED_Y) {
    textureItems.push({ label: 'Axis', value: VECTOR3_AXIS_NAMES[properties.axis] ?? 'Unknown' });
  }
  sections.push({ title: 'Texture', items: textureItems });

  const sheetItems: PropertySection['items'] = [];
  if (properties.hframes > 1 || properties.vframes > 1 || properties.frame > 0) {
    sheetItems.push(
      { label: 'HFrames', value: properties.hframes.toString() },
      { label: 'VFrames', value: properties.vframes.toString() },
      { label: 'Frame', value: properties.frame.toString() }
    );
    if (properties.frame_coords) {
      sheetItems.push({
        label: 'Frame Coords',
        value: `(${properties.frame_coords.x}, ${properties.frame_coords.y})`,
      });
    }
  }
  if (sheetItems.length > 0) {
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

  sections.push({
    title: 'Appearance',
    items: [
      { label: 'Modulate', value: formatColorRgba(properties.modulate) },
      { label: 'Transparency', value: properties.transparency.toFixed(2) },
      { label: 'Alpha Cut', value: alphaCutName(properties.alpha_cut) },
      { label: 'Offset', value: `(${properties.offset.x}, ${properties.offset.y})` },
      { label: 'Render Priority', value: properties.render_priority.toString() },
    ],
  });

  sections.push(...formatNode3DProperties(properties));

  return sections;
}

function billboardName(mode: BillboardMode): string {
  switch (mode) {
    case BillboardMode.BILLBOARD_DISABLED:
      return 'Disabled';
    case BillboardMode.BILLBOARD_ENABLED:
      return 'Enabled';
    case BillboardMode.BILLBOARD_FIXED_Y:
      return 'Y-Axis Only';
    default:
      return 'Unknown';
  }
}

function alphaCutName(mode: AlphaCutMode): string {
  switch (mode) {
    case AlphaCutMode.DISABLED:
      return 'Disabled';
    case AlphaCutMode.DISCARD:
      return 'Discard';
    case AlphaCutMode.OPAQUE_PREPASS:
      return 'Opaque Prepass';
    case AlphaCutMode.HASH:
      return 'Alpha Hash';
    default:
      return 'Unknown';
  }
}
