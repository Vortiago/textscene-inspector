import { VECTOR3_AXIS_NAMES } from '../../../../../../godot/math/vector3Axis';
import { AlphaCutMode } from '../../../../../../godot/rendering/materials/alphaCut';
import { BillboardMode } from '../../../../../../godot/rendering/materials/billboardMode';
import type { InspectedNode, PropertySection } from '../../inspectedNode';
import { formatNode3DProperties } from '../../base/node3d/propertyFormatter';
import { billboardName } from '../../sprites/billboardName';
import { regionSections, spriteSheetSections } from '../../sprites/spriteSheet';
import { resourceText, rgbaText, tupleText } from '../../valueText';

const SPRITE_3D_PROPERTIES = [
  'texture',
  'pixel_size',
  'billboard',
  'axis',
  'modulate',
  'transparency',
  'alpha_cut',
  'offset',
  'render_priority',
] as const;

export async function formatSprite3DProperties(node: InspectedNode): Promise<PropertySection[]> {
  const values = await node.read(SPRITE_3D_PROPERTIES);
  const billboard = values.number('billboard');
  const textureItems = [
    { label: 'Texture', value: resourceText(values.resource('texture')) },
    { label: 'Pixel Size', value: values.number('pixel_size').toFixed(4) },
    { label: 'Billboard', value: billboardName(billboard) },
  ];
  if (billboard === BillboardMode.BILLBOARD_FIXED_Y) {
    textureItems.push({ label: 'Axis', value: VECTOR3_AXIS_NAMES[values.number('axis')] ?? 'Unknown' });
  }
  return [
    { title: 'Texture', items: textureItems },
    ...(await spriteSheetSections(node)),
    ...(await regionSections(node)),
    {
      title: 'Appearance',
      items: [
        { label: 'Modulate', value: rgbaText(values.numbers('modulate')) },
        { label: 'Transparency', value: values.number('transparency').toFixed(2) },
        { label: 'Alpha Cut', value: alphaCutName(values.number('alpha_cut')) },
        { label: 'Offset', value: tupleText(values.numbers('offset')) },
        { label: 'Render Priority', value: values.number('render_priority').toString() },
      ],
    },
    ...(await formatNode3DProperties(node)),
  ];
}

function alphaCutName(mode: number): string {
  switch (mode) {
    case AlphaCutMode.DISABLED:
      return 'Disabled';
    case AlphaCutMode.DISCARD:
      return 'Discard';
    case AlphaCutMode.OPAQUE_PREPASS:
      return 'Opaque Prepass';
    case AlphaCutMode.HASH:
      return 'Alpha Hash';
    default:
      return 'Unknown';
  }
}
