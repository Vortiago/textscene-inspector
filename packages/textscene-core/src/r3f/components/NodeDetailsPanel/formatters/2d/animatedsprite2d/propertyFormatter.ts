import type { InspectedNode, PropertySection } from '../../inspectedNode';
import { formatNode2DProperties } from '../../base/node2d/propertyFormatter';
import { resourceText, tupleText, yesNo } from '../../valueText';

export async function formatAnimatedSprite2DProperties(node: InspectedNode): Promise<PropertySection[]> {
  const values = await node.read([
    'sprite_frames',
    'animation',
    'frame',
    'centered',
    'offset',
    'flip_h',
    'flip_v',
  ]);
  const appearanceItems = [
    { label: 'Centered', value: yesNo(values.boolean('centered')) },
    { label: 'Offset', value: tupleText(values.numbers('offset')) },
  ];
  if (values.boolean('flip_h')) appearanceItems.push({ label: 'Flip H', value: 'Yes' });
  if (values.boolean('flip_v')) appearanceItems.push({ label: 'Flip V', value: 'Yes' });
  return [
    {
      title: 'Animation',
      items: [
        { label: 'Sprite Frames', value: resourceText(values.resource('sprite_frames')) },
        { label: 'Animation', value: values.string('animation') },
        { label: 'Frame', value: values.number('frame').toString() },
      ],
    },
    { title: 'Appearance', items: appearanceItems },
    ...(await formatNode2DProperties(node)),
  ];
}
