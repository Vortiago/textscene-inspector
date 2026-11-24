import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import '../r3f/sceneLiveTree.js';
import { fileBytes } from '../resources/testing/fileBytes';
import { openScene, type Scene } from './openScene';

const MESHES = join(import.meta.dirname, '../../../../scenes/fixtures/meshes');

const MAIN = `[gd_scene format=3]

[ext_resource type="PackedScene" path="res://cube.glb" id="cube"]
[ext_resource type="PackedScene" path="res://wrapper.tscn" id="wrapper"]

[node name="Main" type="Node3D"]

[node name="Cube" parent="." instance=ExtResource("cube")]

[node name="Body" parent="." instance=ExtResource("wrapper")]

[editable path="Body"]
`;

/** A scene whose root inherits the rig glTF: Rig, its MeshInstance3D Torso, and Arm below it. */
const WRAPPER = `[gd_scene format=3]

[ext_resource type="PackedScene" path="res://rig.glb" id="rig"]

[node name="WrapperRoot" instance=ExtResource("rig")]
`;

const FILES: Readonly<Record<string, string | ArrayBuffer>> = {
  'res://cube.glb': fileBytes(join(MESHES, 'unit-cube.glb')),
  'res://rig.glb': fileBytes(join(MESHES, 'unit-glb-rig.glb')),
  'res://wrapper.tscn': WRAPPER,
};

function openMain(): Scene {
  return openScene({ source: MAIN, provider: { loadResource: async (path) => FILES[path] ?? null } });
}

function childPathsOf(scene: Scene, path: string): readonly string[] | undefined {
  return scene
    .getNodeOrNull(path)
    ?.getChildren()
    .map((child) => child.path);
}

// Each tree is what Godot 4.6.3 instantiates (measured).
describe('a node handle lookup alone', () => {
  it('loads a .glb instance, with the node Godot makes of its mesh below it', async () => {
    const scene = openMain();
    await vi.waitFor(() => expect(childPathsOf(scene, 'Cube')).toEqual(['/root/Main/Cube/Cube']));
  });

  it('answers get_class Node3D for the instance, the root the glTF importer makes', async () => {
    const scene = openMain();
    await vi.waitFor(() => expect(scene.getNodeOrNull('Cube')).not.toBeNull());
    expect(await scene.getNode('Cube').call('get_class')).toBe('Node3D');
  });

  it('loads the glTF a sub-scene root inherits, below the node that instances the sub-scene', async () => {
    const scene = openMain();
    await vi.waitFor(() => expect(childPathsOf(scene, 'Body/Rig')).toEqual(['/root/Main/Body/Rig/Torso']));
    expect(await scene.getNode('Body').call('get_class')).toBe('Node3D');
  });

  it('loads the glTF the host opens on its own, with the node of each glTF node below its root', async () => {
    const scene = openScene({
      source: '',
      rootScenePath: 'res://rig.glb',
      provider: { loadResource: async (path) => FILES[path] ?? null },
    });
    await vi.waitFor(() => expect(childPathsOf(scene, 'Rig')).toEqual(['/root/rig/Rig/Torso']));
  });

  it('leaves out an instance whose ext_resource names another type, as Godot does not load it', async () => {
    const source = (type: string) => `[gd_scene format=3]

[ext_resource type="${type}" path="res://sub.tscn" id="sub"]

[node name="Main" type="Node3D"]

[node name="Inst" parent="." instance=ExtResource("sub")]
`;
    const sub =
      '[gd_scene format=3]\n\n[node name="SubRoot" type="Node3D"]\n\n[node name="Kid" type="Node3D" parent="."]\n';
    const open = (type: string) =>
      openScene({
        source: source(type),
        provider: { loadResource: async (path) => (path === 'res://sub.tscn' ? sub : null) },
      });
    const packed = open('PackedScene');
    const texture = open('Texture2D');
    await vi.waitFor(() => expect(packed.getNodeOrNull('Inst/Kid')).not.toBeNull());

    expect(texture.getNodeOrNull('Inst/Kid')).toBeNull();
  });

  it('keeps an instance whose scene the provider has no file for, with the node the host adds below it', async () => {
    const scene = openScene({
      source: `[gd_scene format=3]

[ext_resource type="PackedScene" path="res://gone.tscn" id="gone"]

[node name="Main" type="Node3D"]

[node name="Gone" parent="." instance=ExtResource("gone")]

[node name="Kid" type="Node3D" parent="Gone"]
`,
      provider: { loadResource: async () => null },
    });
    await vi.waitFor(() => expect(scene.files().every((file) => file.state !== 'loading')).toBe(true));

    expect(childPathsOf(scene, 'Gone')).toEqual(['/root/Main/Gone/Kid']);
  });

  it('keeps a node whose sub-scene root inherits a glTF the provider has no file for', async () => {
    const scene = openScene({
      source: MAIN,
      provider: { loadResource: async (path) => (path === 'res://rig.glb' ? null : (FILES[path] ?? null)) },
    });
    await vi.waitFor(() => expect(childPathsOf(scene, 'Cube')).toEqual(['/root/Main/Cube/Cube']));

    await vi.waitFor(() => expect(scene.getNodeOrNull('Body')).not.toBeNull());
  });
});
