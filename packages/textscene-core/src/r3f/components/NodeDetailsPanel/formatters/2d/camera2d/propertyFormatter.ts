import { Camera2DAnchorMode } from '../../../../../../godot/scene/camera2d';
import type { InspectedNode, PropertySection } from '../../inspectedNode';
import { formatNode2DProperties } from '../../base/node2d/propertyFormatter';
import { tupleText, yesNo } from '../../valueText';

function anchorModeName(mode: number): string {
  switch (mode) {
    case Camera2DAnchorMode.FIXED_TOP_LEFT:
      return 'Fixed Top-Left';
    case Camera2DAnchorMode.DRAG_CENTER:
      return 'Drag Center';
    default:
      return 'Unknown';
  }
}

export async function formatCamera2DProperties(node: InspectedNode): Promise<PropertySection[]> {
  const values = await node.read(['zoom', 'offset', 'anchor_mode', 'enabled']);
  return [
    {
      title: 'Camera',
      items: [
        { label: 'Zoom', value: tupleText(values.numbers('zoom')) },
        { label: 'Offset', value: tupleText(values.numbers('offset')) },
        { label: 'Anchor Mode', value: anchorModeName(values.number('anchor_mode')) },
        { label: 'Enabled', value: yesNo(values.boolean('enabled')) },
      ],
    },
    ...(await formatNode2DProperties(node)),
  ];
}
