/**
 * Sprite3D property formatter — formats sprite properties for the
 * details panel.
 */

import type { PropertySection } from '../../../core/NodeRegistry';
import {
  AlphaCutMode,
  AxisMode,
  BillboardMode,
  type Sprite3DProperties,
} from './types';
import { formatNode3DProperties } from '../../base/node3d/propertyFormatter';

export function formatSprite3DProperties(properties: Sprite3DProperties): PropertySection[] {
  const sections: PropertySection[] = [];

  const textureItems: PropertySection['items'] = [
    { label: 'Texture', value: properties.texture ?? '(none)' },
    { label: 'Pixel Size', value: properties.pixel_size.toFixed(4) },
    { label: 'Billboard', value: billboardName(properties.billboard) },
  ];
  if (properties.billboard === BillboardMode.BILLBOARD_FIXED_Y) {
    textureItems.push({ label: 'Axis', value: axisName(properties.axis) });
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
      {
        label: 'Modulate',
        value: `rgba(${(properties.modulate.r * 255).toFixed(0)}, ${(properties.modulate.g * 255).toFixed(0)}, ${(properties.modulate.b * 255).toFixed(0)}, ${properties.modulate.a.toFixed(2)})`,
      },
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
    case BillboardMode.BILLBOARD_DISABLED: return 'Disabled';
    case BillboardMode.BILLBOARD_ENABLED: return 'Enabled';
    case BillboardMode.BILLBOARD_FIXED_Y: return 'Y-Axis Only';
    case BillboardMode.BILLBOARD_PARTICLES: return 'Particles (Unsupported)';
    default: return 'Unknown';
  }
}

function alphaCutName(mode: AlphaCutMode): string {
  switch (mode) {
    case AlphaCutMode.ALPHA_CUT_DISABLED: return 'Disabled';
    case AlphaCutMode.ALPHA_CUT_DISCARD: return 'Discard';
    case AlphaCutMode.ALPHA_CUT_OPAQUE_PREPASS: return 'Opaque Prepass';
    default: return 'Unknown';
  }
}

function axisName(axis: AxisMode): string {
  switch (axis) {
    case AxisMode.AXIS_X: return 'X';
    case AxisMode.AXIS_Y: return 'Y';
    case AxisMode.AXIS_Z: return 'Z';
    default: return 'Unknown';
  }
}
