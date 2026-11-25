import type { InspectedNode, PropertySection } from '../inspectedNode';
import { tupleText } from '../valueText';

/** The sheet rows show once the sheet holds more than one frame or a later frame shows. */
export async function spriteSheetSections(node: InspectedNode): Promise<PropertySection[]> {
  const values = await node.read(['hframes', 'vframes', 'frame', 'frame_coords']);
  const [hframes, vframes, frame] = [
    values.number('hframes'),
    values.number('vframes'),
    values.number('frame'),
  ];
  if (hframes <= 1 && vframes <= 1 && frame <= 0) return [];
  const items = [
    { label: 'HFrames', value: hframes.toString() },
    { label: 'VFrames', value: vframes.toString() },
    { label: 'Frame', value: frame.toString() },
  ];
  if (node.fileProperties.has('frame_coords')) {
    items.push({ label: 'Frame Coords', value: tupleText(values.numbers('frame_coords')) });
  }
  return [{ title: 'Sprite Sheet', items }];
}

export async function regionSections(node: InspectedNode): Promise<PropertySection[]> {
  const values = await node.read(['region_enabled', 'region_rect']);
  if (!values.boolean('region_enabled') || !node.fileProperties.has('region_rect')) return [];
  return [
    {
      title: 'Region',
      items: [
        { label: 'Enabled', value: 'true' },
        { label: 'Rect', value: tupleText(values.numbers('region_rect')) },
      ],
    },
  ];
}
