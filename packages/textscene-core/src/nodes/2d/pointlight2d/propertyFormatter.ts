/**
 * PointLight2D property formatter — formats light properties for the
 * details panel. Mirrors the Sprite2D formatter for the 2D surface.
 */

import type { PropertySection } from '../../../core/NodeRegistry';
import type { PointLight2DProperties } from './types';
import { formatColorRgba } from '../../../utils/colorParser';
import { formatNode2DProperties } from '../../base/node2d/propertyFormatter';

const BLEND_MODE_LABELS: Record<number, string> = { 0: 'ADD', 1: 'SUB', 2: 'MIX' };

export function formatPointLight2DProperties(props: PointLight2DProperties): PropertySection[] {
  const sections: PropertySection[] = [
    {
      title: 'Light',
      items: [
        { label: 'Enabled', value: props.enabled ? 'Yes' : 'No' },
        { label: 'Color', value: formatColorRgba(props.color) },
        { label: 'Energy', value: props.energy.toFixed(2) },
        { label: 'Blend Mode', value: BLEND_MODE_LABELS[props.blend_mode] ?? String(props.blend_mode) },
        { label: 'Texture Scale', value: props.texture_scale.toFixed(2) },
      ],
    },
  ];
  sections.push(...formatNode2DProperties(props));
  return sections;
}
