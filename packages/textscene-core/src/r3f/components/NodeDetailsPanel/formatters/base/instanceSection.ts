import type { InspectedNode, PropertySection } from '../inspectedNode';

/** The scene the node instances, as `scene_file_path` names it. The scene's root names its own file: null. */
export async function instancedScenePath(node: InspectedNode): Promise<string | null> {
  const scenePath = (await node.read(['scene_file_path'])).string('scene_file_path');
  if (scenePath === '' || (await node.call('get_owner')) === null) return null;
  return scenePath;
}

export async function instanceSection(node: InspectedNode): Promise<PropertySection[]> {
  const scenePath = await instancedScenePath(node);
  return scenePath === null ? [] : [{ title: 'Instance', items: [{ label: 'Scene', value: scenePath }] }];
}
