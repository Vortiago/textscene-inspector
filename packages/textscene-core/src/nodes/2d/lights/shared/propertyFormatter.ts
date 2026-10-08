/** Formats the Light2D surface for the details panel, with each light type's own items in its Light section. */

import type { PropertyItem, PropertySection } from '../../../../core/NodeRegistry';
import type { Light2DProperties } from './types';
import { formatColorRgba } from '../../../../utils/colorParser';
import { formatNode2DProperties } from '../../../base/node2d/propertyFormatter';

const BLEND_MODE_LABELS: Record<number, string> = { 0: 'ADD', 1: 'SUB', 2: 'MIX' };
const SHADOW_FILTER_LABELS: Record<number, string> = { 0: 'None', 1: 'PCF5', 2: 'PCF13' };

export function formatLight2DProperties(
  props: Light2DProperties,
  ownItems: readonly PropertyItem[]
): PropertySection[] {
  return [
    {
      title: 'Light',
      items: [
        { label: 'Enabled', value: props.enabled ? 'Yes' : 'No' },
        { label: 'Color', value: formatColorRgba(props.color) },
        { label: 'Energy', value: props.energy.toFixed(2) },
        { label: 'Blend Mode', value: BLEND_MODE_LABELS[props.blend_mode] ?? String(props.blend_mode) },
        ...ownItems,
        // The mask that decides what this light lights, distinct from the
        // node's own CanvasItem `light_mask`, which the Node2D section carries.
        { label: 'Range Item Cull Mask', value: props.range_item_cull_mask.toString() },
        { label: 'Shadow Item Cull Mask', value: props.shadow_item_cull_mask.toString() },
        // The two windows are inherently pairs, and an inverted one reaches
        // nothing, so they read as intervals rather than four loose numbers.
        { label: 'Range Z', value: `${props.range_z_min} to ${props.range_z_max}` },
        { label: 'Range Layer', value: `${props.range_layer_min} to ${props.range_layer_max}` },
      ],
    },
    {
      title: 'Shadow',
      items: [
        { label: 'Enabled', value: props.shadow_enabled ? 'Yes' : 'No' },
        { label: 'Color', value: formatColorRgba(props.shadow_color) },
        {
          label: 'Filter',
          value: SHADOW_FILTER_LABELS[props.shadow_filter] ?? String(props.shadow_filter),
        },
        { label: 'Filter Smooth', value: props.shadow_filter_smooth.toFixed(2) },
      ],
    },
    ...formatNode2DProperties(props),
  ];
}
