import { SHADOW_CASTING_SETTING_NAMES } from '../../../../../../godot/rendering/rendering';
import type { InspectedNode, PropertySection } from '../../inspectedNode';
import { formatNode3DProperties } from '../../base/node3d/propertyFormatter';
import { resourceText } from '../../valueText';
import { indexedKeyRegex } from '../../../../../../godot/classdb/indexedKey';
import { stringToInt } from '../../../../../../godot/string/string';

// Godot reads the index with `to_int` (mesh_instance_3d.cpp:66).
const OVERRIDE = indexedKeyRegex('^surface_material_override/(#)$', 'to_int');

export async function formatMeshInstance3DProperties(node: InspectedNode): Promise<PropertySection[]> {
  const values = await node.read(['mesh', 'cast_shadow', 'skeleton', 'skin']);
  const items = [];
  const mesh = values.resource('mesh');
  if (mesh !== null) items.push({ label: 'Mesh', value: mesh });
  const castShadow = values.number('cast_shadow');
  items.push({
    label: 'Cast Shadow',
    value: SHADOW_CASTING_SETTING_NAMES[castShadow] ?? `Unknown (${castShadow})`,
  });
  if (node.fileProperties.has('skeleton'))
    items.push({ label: 'Skeleton', value: values.string('skeleton') });
  const skin = values.resource('skin');
  if (skin !== null) items.push({ label: 'Skin', value: skin });
  return [
    { title: 'Mesh', items },
    ...(await overrideSections(node)),
    ...(await formatNode3DProperties(node)),
  ];
}

/** A row for each override the file sets on a surface the mesh has, in the order the file sets them. */
async function overrideSections(node: InspectedNode): Promise<PropertySection[]> {
  const overrides = [...node.fileProperties].filter((name) => OVERRIDE.test(name));
  const values = await node.read(overrides);
  // Godot drops an override past the mesh's last surface, so `get` answers null (mesh_instance_3d.cpp:67).
  const held = overrides.filter((name) => values.has(name));
  if (held.length === 0) return [];
  const items = held.map((name) => ({
    label: `Surface ${stringToInt(OVERRIDE.exec(name)![1]!)}`,
    value: resourceText(values.resource(name)),
  }));
  return [{ title: 'Material Overrides', items }];
}
