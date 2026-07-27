/**
 * Node2D property formatter — formats the 2D transform, draw order, and
 * CanvasItem tint for display. The 2D analogue of `formatNode3DProperties`;
 * 2D slices append these sections after their own type-specific ones.
 */

import type { PropertySection } from '../../../core/NodeRegistry';
import type { Color, Node2DProperties } from './types';
import { formatColorRgba } from '../../../utils/colorParser';

export { formatColorRgba };

const radToDeg = (rad: number) => ((rad * 180) / Math.PI).toFixed(2);

function isWhite(color: Color): boolean {
  return color.r === 1 && color.g === 1 && color.b === 1 && color.a === 1;
}

export function formatNode2DProperties(properties: Node2DProperties): PropertySection[] {
  const sections: PropertySection[] = [];

  sections.push({
    title: 'Position',
    items: [
      { label: 'X', value: properties.position.x.toFixed(1) },
      { label: 'Y', value: properties.position.y.toFixed(1) },
    ],
  });

  const rotationItems: PropertySection['items'] = [
    { label: 'Angle', value: radToDeg(properties.rotation) },
  ];
  if (properties.skew !== 0) {
    rotationItems.push({ label: 'Skew', value: radToDeg(properties.skew) });
  }
  sections.push({ title: 'Rotation (degrees)', items: rotationItems });

  sections.push({
    title: 'Scale',
    items: [
      { label: 'X', value: properties.scale.x.toFixed(3) },
      { label: 'Y', value: properties.scale.y.toFixed(3) },
    ],
  });

  const orderingItems: PropertySection['items'] = [
    { label: 'Z Index', value: properties.z_index.toString() },
    { label: 'Z As Relative', value: properties.z_as_relative ? 'Yes' : 'No' },
  ];
  if (properties.show_behind_parent) {
    orderingItems.push({ label: 'Show Behind Parent', value: 'Yes' });
  }
  sections.push({ title: 'Ordering', items: orderingItems });

  const canvasItems: PropertySection['items'] = [
    { label: 'Modulate', value: formatColorRgba(properties.modulate) },
  ];
  if (!isWhite(properties.self_modulate)) {
    canvasItems.push({ label: 'Self Modulate', value: formatColorRgba(properties.self_modulate) });
  }
  // Only when it says something: 1 is every item's default, and a row repeating
  // it on every node would bury the masks that actually cull a light.
  if (properties.light_mask !== 1) {
    canvasItems.push({ label: 'Light Mask', value: properties.light_mask.toString() });
  }
  if (properties.y_sort_enabled) {
    canvasItems.push({ label: 'Y Sort Enabled', value: 'Yes' });
    if (properties.y_sort_origin !== 0) {
      canvasItems.push({ label: 'Y Sort Origin', value: properties.y_sort_origin.toFixed(1) });
    }
  }
  sections.push({ title: 'CanvasItem', items: canvasItems });

  if (properties.instance) {
    sections.push({
      title: 'Instance',
      items: [{ label: 'Scene', value: properties.instance }],
    });
  }

  return sections;
}
