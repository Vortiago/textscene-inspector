import { describe, expect, it, vi } from 'vitest';
import '../r3f/sceneLiveTree.js';
import { openScene, type Scene } from './openScene';
import type { NodeHandle } from './nodeHandle';
import type { ResourceProvider } from '../resources/ResourceProvider';

const SUB = `[gd_scene format=3]

[node name="SubRoot" type="Node3D"]

[node name="Inner" type="Node3D" parent="."]

[node name="Deep" type="Node3D" parent="Inner"]
`;

const MAIN = `[gd_scene format=3]

[ext_resource type="PackedScene" path="res://sub.tscn" id="1"]

[node name="Main" type="Node3D"]

[node name="Plain" type="Node3D" parent="."]

[node name="Inst" parent="Plain" instance=ExtResource("1")]

[node name="Added" type="Node3D" parent="Plain/Inst/Inner"]

[editable path="Plain/Inst"]
`;

const provider: ResourceProvider = {
  loadResource: async (path) => (path === 'res://sub.tscn' ? SUB : null),
};

async function loadedMain(): Promise<Scene> {
  const scene = openScene({ source: MAIN, provider, rootScenePath: 'res://main.tscn' });
  scene.getNodeOrNull('Plain/Inst');
  await vi.waitFor(() => expect(scene.getNodeOrNull('Plain/Inst/Inner/Deep')).not.toBeNull());
  return scene;
}

const ownerName = async (node: NodeHandle) =>
  ((await node.call('get_owner')) as NodeHandle | null)?.name ?? null;

// Each answer is measured in Godot 4.6.3 on these two scenes, added under the root window.
describe('get_owner', () => {
  it.each([
    ['.', null],
    ['Plain', 'Main'],
    ['Plain/Inst', 'Main'],
    ['Plain/Inst/Inner', 'Inst'],
    ['Plain/Inst/Inner/Deep', 'Inst'],
    ['Plain/Inst/Inner/Added', 'Main'],
  ])('of %s is %s', async (path, owner) => {
    const scene = await loadedMain();
    expect(await ownerName(scene.getNode(path))).toBe(owner);
  });

  it('is null for the root window', async () => {
    const scene = await loadedMain();
    expect(await scene.getNodeOrNull('/root')!.call('get_owner')).toBeNull();
  });
});

describe('scene_file_path', () => {
  it.each([
    ['.', 'res://main.tscn'],
    ['Plain', ''],
    ['Plain/Inst', 'res://sub.tscn'],
    ['Plain/Inst/Inner', ''],
    ['Plain/Inst/Inner/Added', ''],
  ])('of %s is %j', async (path, sceneFilePath) => {
    const scene = await loadedMain();
    expect(await scene.getNode(path).get('scene_file_path')).toBe(sceneFilePath);
  });

  it('is empty for the root window', async () => {
    const scene = await loadedMain();
    expect(await scene.getNodeOrNull('/root')!.call('get_scene_file_path')).toBe('');
  });
});
