import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { fileBytes } from '../../../resources/testing/fileBytes';
import { expandAllRows, renderSceneTree, rowAt, rowPaths, type TreeFiles } from './sceneTree.testkit';

/** Rig, its mesh Torso, and Arm below Torso. */
const RIG_GLB = fileBytes(
  join(import.meta.dirname, '../../../../../../scenes/fixtures/meshes/unit-glb-rig.glb')
);

const WRAPPER = `[gd_scene format=3]

[ext_resource type="PackedScene" path="res://rig.glb" id="rig"]

[node name="WrapperRoot" instance=ExtResource("rig")]
`;

const FILES: TreeFiles = { 'res://rig.glb': RIG_GLB, 'res://wrapper.tscn': WRAPPER };

async function renderTree(source: string, lastLoaded: string, rootScenePath?: string) {
  const { scene } = await renderSceneTree(source, { files: FILES, rootScenePath });
  await expandAllRows(scene, lastLoaded);
}

describe('<SceneTreeViewer> glTF rows', () => {
  it('lists each node of a glTF the host opens on its own below its Node3D root', async () => {
    await renderTree('', 'Rig/Torso/Arm', 'res://rig.glb');

    expect(rowPaths()).toEqual(['rig', 'rig/Rig', 'rig/Rig/Torso', 'rig/Rig/Torso/Arm']);
    expect(rowAt('rig')!.querySelector('[title="Node3D"]')).not.toBeNull();
  });

  it('lists a node the inheriting scene adds inside the glTF under the glTF node it names', async () => {
    await renderTree(
      `[gd_scene format=3]

[ext_resource type="PackedScene" path="res://rig.glb" id="rig"]

[node name="Rig" instance=ExtResource("rig")]

[node name="Marker" type="Marker3D" parent="Rig/Torso"]
`,
      'Rig/Torso/Arm'
    );

    expect(rowPaths()).toEqual([
      'Rig',
      'Rig/Rig',
      'Rig/Rig/Torso',
      'Rig/Rig/Torso/Arm',
      'Rig/Rig/Torso/Marker',
    ]);
  });

  it('lists the glTF a sub-scene root inherits below the editable node that instances the sub-scene', async () => {
    await renderTree(
      `[gd_scene format=3]

[ext_resource type="PackedScene" path="res://wrapper.tscn" id="wrapper"]

[node name="Main" type="Node3D"]

[node name="Body" parent="." instance=ExtResource("wrapper")]

[editable path="Body"]
`,
      'Body/Rig/Torso/Arm'
    );

    expect(rowPaths()).toEqual([
      'Main',
      'Main/Body',
      'Main/Body/Rig',
      'Main/Body/Rig/Torso',
      'Main/Body/Rig/Torso/Arm',
    ]);
    expect(rowAt('Main/Body')!.querySelector('[title="Node3D"]')).not.toBeNull();
  });
});
