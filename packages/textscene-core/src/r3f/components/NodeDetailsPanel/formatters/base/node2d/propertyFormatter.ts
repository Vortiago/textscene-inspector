import {
  CANVAS_ITEM_CLIP_CHILDREN_MODE_NAMES,
  CanvasItemClipChildrenMode,
} from '../../../../../../godot/scene/canvasItem';
import type { InspectedNode, NodeValues, PropertySection } from '../../inspectedNode';
import { instanceSection } from '../instanceSection';
import { degreesText, rgbaText, yesNo } from '../../valueText';

const NODE_2D_PROPERTIES = [
  'position',
  'rotation',
  'skew',
  'scale',
  'z_index',
  'z_as_relative',
  'show_behind_parent',
  'modulate',
  'self_modulate',
  'light_mask',
  'clip_children',
  'y_sort_enabled',
] as const;

type Node2DProperty = (typeof NODE_2D_PROPERTIES)[number];

function isWhite(color: readonly number[]): boolean {
  return color.every((channel) => channel === 1);
}

export async function formatNode2DProperties(node: InspectedNode): Promise<PropertySection[]> {
  const values = await node.read(NODE_2D_PROPERTIES);
  const [x = 0, y = 0] = values.numbers('position');
  const [scaleX = 1, scaleY = 1] = values.numbers('scale');
  const sections: PropertySection[] = [
    {
      title: 'Position',
      items: [
        { label: 'X', value: x.toFixed(1) },
        { label: 'Y', value: y.toFixed(1) },
      ],
    },
  ];

  const rotationItems = [{ label: 'Angle', value: degreesText(values.number('rotation')) }];
  const skew = values.number('skew');
  if (skew !== 0) rotationItems.push({ label: 'Skew', value: degreesText(skew) });
  sections.push({ title: 'Rotation (degrees)', items: rotationItems });

  sections.push({
    title: 'Scale',
    items: [
      { label: 'X', value: scaleX.toFixed(3) },
      { label: 'Y', value: scaleY.toFixed(3) },
    ],
  });

  const orderingItems = [
    { label: 'Z Index', value: values.number('z_index').toString() },
    { label: 'Z As Relative', value: yesNo(values.boolean('z_as_relative')) },
  ];
  if (values.boolean('show_behind_parent')) orderingItems.push({ label: 'Show Behind Parent', value: 'Yes' });
  sections.push({ title: 'Ordering', items: orderingItems });

  sections.push({ title: 'CanvasItem', items: await canvasItemRows(node, values) });
  sections.push(...(await instanceSection(node)));
  return sections;
}

async function canvasItemRows(
  node: InspectedNode,
  values: NodeValues<Node2DProperty>
): Promise<PropertySection['items']> {
  const items = [{ label: 'Modulate', value: rgbaText(values.numbers('modulate')) }];
  const selfModulate = values.numbers('self_modulate');
  if (!isWhite(selfModulate)) items.push({ label: 'Self Modulate', value: rgbaText(selfModulate) });
  // 1 is every item's default, and a row repeating it on every node would bury the masks that cull a light.
  const lightMask = values.number('light_mask');
  if (lightMask !== 1) items.push({ label: 'Light Mask', value: lightMask.toString() });
  const clipChildren = values.number('clip_children');
  if (clipChildren !== CanvasItemClipChildrenMode.DISABLED) {
    items.push({ label: 'Clip Children', value: CANVAS_ITEM_CLIP_CHILDREN_MODE_NAMES[clipChildren] ?? '' });
  }
  if (values.boolean('y_sort_enabled')) {
    items.push({ label: 'Y Sort Enabled', value: 'Yes' });
    items.push(...(await ySortOriginRows(node)));
  }
  return items;
}

/** Only a TileMapLayer has `y_sort_origin`. Another class answers null, and shows no row. */
async function ySortOriginRows(node: InspectedNode): Promise<PropertySection['items']> {
  const values = await node.read(['y_sort_origin']);
  if (!values.has('y_sort_origin')) return [];
  const origin = values.number('y_sort_origin');
  return origin === 0 ? [] : [{ label: 'Y Sort Origin', value: origin.toFixed(1) }];
}
