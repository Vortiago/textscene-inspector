/**
 * Camera2D property formatter — formats view-framing properties for the
 * details panel.
 */

import type { PropertySection } from '../../../core/NodeRegistry';
import { Camera2DAnchorMode, type Camera2DProperties } from './types';
import { formatNode2DProperties } from '../../base/node2d/propertyFormatter';

export function formatCamera2DProperties(properties: Camera2DProperties): PropertySection[] {
  const sections: PropertySection[] = [];

  sections.push({
    title: 'Camera',
    items: [
      { label: 'Zoom', value: `(${properties.zoom.x}, ${properties.zoom.y})` },
      { label: 'Offset', value: `(${properties.offset.x}, ${properties.offset.y})` },
      { label: 'Anchor Mode', value: anchorModeName(properties.anchor_mode) },
      { label: 'Enabled', value: properties.enabled ? 'Yes' : 'No' },
    ],
  });

  sections.push(...formatNode2DProperties(properties));

  return sections;
}

function anchorModeName(mode: number): string {
  switch (mode) {
    case Camera2DAnchorMode.FIXED_TOP_LEFT: return 'Fixed Top-Left';
    case Camera2DAnchorMode.DRAG_CENTER: return 'Drag Center';
    default: return 'Unknown';
  }
}
