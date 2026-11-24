import { describe, expect, it, vi } from 'vitest';
import '../r3f/sceneLiveTree.js';
import { openScene, type Scene } from './openScene';
import type { ResourceProvider } from '../resources/ResourceProvider';

const SUB = `[gd_scene format=3]

[node name="Sub" type="Node3D"]

[node name="Inner" type="Node3D" parent="."]
`;

const MAIN = `[gd_scene format=3]

[ext_resource type="PackedScene" path="res://sub.tscn" id="1"]

[node name="Main" type="Node3D"]

[node name="Plain" parent="." instance=ExtResource("1")]

[node name="Editable" parent="." instance=ExtResource("1")]

[node name="Still" type="Node3D" parent="."]

[editable path="Editable"]
`;

const provider: ResourceProvider = {
  loadResource: async (path) => (path === 'res://sub.tscn' ? SUB : null),
};

async function loadedMain(): Promise<Scene> {
  const scene = openScene({ source: MAIN, provider, rootScenePath: 'res://main.tscn' });
  scene.getNodeOrNull('Plain/Inner');
  scene.getNodeOrNull('Editable/Inner');
  await vi.waitFor(() => expect(scene.getNodeOrNull('Editable/Inner')).not.toBeNull());
  return scene;
}

// Each answer is measured in Godot 4.6.3 on this scene, instantiated with GEN_EDIT_STATE_MAIN.
describe('is_editable_instance', () => {
  it.each([
    ['Editable', true],
    ['Plain', false],
    ['Still', false],
    ['Editable/Inner', false],
  ])('of %s from the root is %s', async (path, isEditable) => {
    const scene = await loadedMain();
    const root = scene.getNode('.');
    expect(await root.call('is_editable_instance', scene.getNode(path))).toBe(isEditable);
  });

  it('is false for a node that is not below the caller, as Godot refuses it', async () => {
    const scene = await loadedMain();
    const plain = scene.getNode('Plain');
    expect(await plain.call('is_editable_instance', scene.getNode('Editable'))).toBe(false);
  });

  it('refuses an argument that is not a node, with the type it found', async () => {
    const scene = await loadedMain();
    await expect(scene.getNode('.').call('is_editable_instance', 'Editable')).rejects.toThrow(
      'Node3D::is_editable_instance: Cannot convert argument 1 from String to Object.'
    );
  });
});
