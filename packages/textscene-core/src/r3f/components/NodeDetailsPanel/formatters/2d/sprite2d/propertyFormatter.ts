import type { InspectedNode, PropertySection } from '../../inspectedNode';
import { formatNode2DProperties } from '../../base/node2d/propertyFormatter';
import { regionSections, spriteSheetSections } from '../../sprites/spriteSheet';
import { resourceText, tupleText, yesNo } from '../../valueText';

export async function formatSprite2DProperties(node: InspectedNode): Promise<PropertySection[]> {
  const values = await node.read(['texture', 'centered', 'offset', 'flip_h', 'flip_v']);
  const textureItems = [
    { label: 'Texture', value: resourceText(values.resource('texture')) },
    { label: 'Centered', value: yesNo(values.boolean('centered')) },
    { label: 'Offset', value: tupleText(values.numbers('offset')) },
  ];
  if (values.boolean('flip_h')) textureItems.push({ label: 'Flip H', value: 'Yes' });
  if (values.boolean('flip_v')) textureItems.push({ label: 'Flip V', value: 'Yes' });
  return [
    { title: 'Texture', items: textureItems },
    ...(await spriteSheetSections(node)),
    ...(await regionSections(node)),
    ...(await formatNode2DProperties(node)),
  ];
}
