import {
  LIGHT_2D_BLEND_MODE_NAMES,
  LIGHT_2D_SHADOW_FILTER_HINT_NAMES,
} from '../../../../../../../godot/scene/light2d';
import type { InspectedNode, PropertyItem, PropertySection } from '../../../inspectedNode';
import { formatNode2DProperties } from '../../../base/node2d/propertyFormatter';
import { rgbaText, yesNo } from '../../../valueText';

const LIGHT_2D_PROPERTIES = [
  'enabled',
  'color',
  'energy',
  'blend_mode',
  'range_item_cull_mask',
  'shadow_item_cull_mask',
  'range_z_min',
  'range_z_max',
  'range_layer_min',
  'range_layer_max',
  'shadow_enabled',
  'shadow_color',
  'shadow_filter',
  'shadow_filter_smooth',
] as const;

export async function formatLight2DProperties(
  node: InspectedNode,
  ownItems: readonly PropertyItem[]
): Promise<PropertySection[]> {
  const values = await node.read(LIGHT_2D_PROPERTIES);
  const blendMode = values.number('blend_mode');
  const shadowFilter = values.number('shadow_filter');
  return [
    {
      title: 'Light',
      items: [
        { label: 'Enabled', value: yesNo(values.boolean('enabled')) },
        { label: 'Color', value: rgbaText(values.numbers('color')) },
        { label: 'Energy', value: values.number('energy').toFixed(2) },
        { label: 'Blend Mode', value: LIGHT_2D_BLEND_MODE_NAMES[blendMode] ?? String(blendMode) },
        ...ownItems,
        // The mask that decides what this light lights, not the node's own CanvasItem `light_mask`.
        { label: 'Range Item Cull Mask', value: values.number('range_item_cull_mask').toString() },
        { label: 'Shadow Item Cull Mask', value: values.number('shadow_item_cull_mask').toString() },
        // Each window is a pair, and an inverted one reaches nothing, so each reads as an interval.
        { label: 'Range Z', value: `${values.number('range_z_min')} to ${values.number('range_z_max')}` },
        {
          label: 'Range Layer',
          value: `${values.number('range_layer_min')} to ${values.number('range_layer_max')}`,
        },
      ],
    },
    {
      title: 'Shadow',
      items: [
        { label: 'Enabled', value: yesNo(values.boolean('shadow_enabled')) },
        { label: 'Color', value: rgbaText(values.numbers('shadow_color')) },
        { label: 'Filter', value: LIGHT_2D_SHADOW_FILTER_HINT_NAMES[shadowFilter] ?? String(shadowFilter) },
        { label: 'Filter Smooth', value: values.number('shadow_filter_smooth').toFixed(2) },
      ],
    },
    ...(await formatNode2DProperties(node)),
  ];
}
