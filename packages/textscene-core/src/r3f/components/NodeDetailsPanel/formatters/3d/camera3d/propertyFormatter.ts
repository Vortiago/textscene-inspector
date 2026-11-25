import {
  CAMERA_3D_KEEP_ASPECT_HINT_NAMES,
  CAMERA_3D_PROJECTION_HINT_NAMES,
  Camera3DKeepAspect,
  Camera3DProjectionType,
} from '../../../../../../godot/scene/camera3d';
import type { InspectedNode, PropertyItem, PropertySection } from '../../inspectedNode';
import { formatNode3DProperties } from '../../base/node3d/propertyFormatter';
import { yesNo } from '../../valueText';

/** `_update_camera_mode` treats every mode but KEEP_WIDTH as KEEP_HEIGHT (camera_3d.cpp:274). */
function keepAspectName(mode: number): string {
  const used = mode === Camera3DKeepAspect.KEEP_WIDTH ? mode : Camera3DKeepAspect.KEEP_HEIGHT;
  return CAMERA_3D_KEEP_ASPECT_HINT_NAMES[used]!;
}

const CAMERA_3D_PROPERTIES = [
  'projection',
  'keep_aspect',
  'fov',
  'size',
  'near',
  'far',
  'h_offset',
  'v_offset',
  'frustum_offset',
  'current',
  'cull_mask',
  'doppler_tracking',
] as const;

export async function formatCamera3DProperties(node: InspectedNode): Promise<PropertySection[]> {
  const values = await node.read(CAMERA_3D_PROPERTIES);
  const projection = values.number('projection');
  const cameraItems: PropertyItem[] = [
    { label: 'Projection', value: CAMERA_3D_PROJECTION_HINT_NAMES[projection] ?? 'Unknown' },
    { label: 'Keep Aspect', value: keepAspectName(values.number('keep_aspect')) },
  ];
  if (projection === Camera3DProjectionType.PERSPECTIVE) {
    cameraItems.push({ label: 'FOV', value: `${values.number('fov').toFixed(1)}°` });
  } else if (projection === Camera3DProjectionType.ORTHOGONAL) {
    cameraItems.push({ label: 'Size', value: values.number('size').toFixed(2) });
  }
  cameraItems.push(
    { label: 'Near', value: values.number('near').toFixed(3) },
    { label: 'Far', value: values.number('far').toFixed(1) }
  );
  const sections: PropertySection[] = [{ title: 'Camera', items: cameraItems }];

  const offsetItems = offsetRows(
    values.number('h_offset'),
    values.number('v_offset'),
    values.numbers('frustum_offset')
  );
  if (offsetItems.length > 0) sections.push({ title: 'Offsets', items: offsetItems });

  const additionalItems = [
    { label: 'Current', value: yesNo(values.boolean('current')) },
    { label: 'Cull Mask', value: values.number('cull_mask').toString() },
  ];
  const dopplerTracking = values.number('doppler_tracking');
  if (dopplerTracking !== 0)
    additionalItems.push({ label: 'Doppler Tracking', value: dopplerTracking.toString() });
  sections.push({ title: 'Additional', items: additionalItems });
  return [...sections, ...(await formatNode3DProperties(node))];
}

/** A row for each offset off zero. */
function offsetRows(
  hOffset: number,
  vOffset: number,
  [frustumX = 0, frustumY = 0]: readonly number[]
): PropertyItem[] {
  const items: PropertyItem[] = [];
  if (hOffset !== 0) items.push({ label: 'H Offset', value: hOffset.toFixed(2) });
  if (vOffset !== 0) items.push({ label: 'V Offset', value: vOffset.toFixed(2) });
  if (frustumX !== 0 || frustumY !== 0) {
    items.push({ label: 'Frustum Offset', value: `(${frustumX.toFixed(2)}, ${frustumY.toFixed(2)})` });
  }
  return items;
}
