/**
 * A node of an instanced scene that a RemoteTransform moves draws at the relay's pose. The sub-scene's
 * nodes are shared by every instance, so the dispatcher reads the move by the live path of each node.
 */

import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { parseTscnContent } from './hooks/useParsedScene';
import { DispatchedScene } from './testing/DispatchedScene';
import { settleLoads } from './testing/settleLoads';
import { ProjectSettingsProvider } from './contexts/ProjectSettingsContext';
import { loaderServing } from '../resources/testing/servingResourceLoader';
import { instanceAs } from '../nodes/3d/testing/reactThreeTestInstance';
import './nodes/index';

const HOLDER_FILE = 'res://holder.tscn';

/** A sub-scene whose relay at +2 drives a box mesh at -2. */
const HOLDER = `[gd_scene load_steps=2 format=3]
[sub_resource type="BoxMesh" id="Box"]
[node name="Holder" type="Node3D"]
[node name="Target" type="MeshInstance3D" parent="."]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, -2, 0, 0)
mesh = SubResource("Box")
[node name="Relay" type="RemoteTransform3D" parent="."]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 2, 0, 0)
remote_path = NodePath("../Target")
`;

const HOST = `[gd_scene load_steps=2 format=3]
[ext_resource type="PackedScene" path="${HOLDER_FILE}" id="1_holder"]
[node name="Root" type="Node3D"]
[node name="A" parent="." instance=ExtResource("1_holder")]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 10, 0, 0)
[node name="B" parent="." instance=ExtResource("1_holder")]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 20, 0, 0)
`;

async function renderHost(content: string, files: Record<string, string>) {
  const { sceneGraph, error } = parseTscnContent(content, 'res://main.tscn');
  if (!sceneGraph) throw new Error(`expected a scene, got ${error}`);
  const renderer = await ReactThreeTestRenderer.create(
    <DispatchedScene sceneGraph={sceneGraph} loader={loaderServing(files)} />
  );
  await settleLoads();
  return renderer;
}

/** The world X of every mesh of the scene, in tree order. */
function meshWorldXs(renderer: Awaited<ReturnType<typeof renderHost>>): number[] {
  return renderer.scene.findAllByType('Mesh').map((m) => {
    const mesh = instanceAs<THREE.Mesh>(m);
    mesh.updateWorldMatrix(true, false);
    return mesh.getWorldPosition(new THREE.Vector3()).x;
  });
}

describe('a RemoteTransform target inside an instanced scene', () => {
  it('draws at the relay’s pose in each instance, not at its authored one', async () => {
    const renderer = await renderHost(HOST, { [HOLDER_FILE]: HOLDER });

    // The relay sits 2 into each instance, which sit at 10 and 20.
    expect(meshWorldXs(renderer)).toEqual([expect.closeTo(12, 5), expect.closeTo(22, 5)]);
  });
});

describe('a y-sorted ancestor that a RemoteTransform2D moves', () => {
  const SORTED = `[gd_scene format=3]
[node name="Root" type="Node2D"]
y_sort_enabled = true
[node name="Props" type="Node2D" parent="."]
y_sort_enabled = true
[node name="Marker" type="Polygon2D" parent="Props"]
position = Vector2(5, 0)
polygon = PackedVector2Array(0, 0, 4, 0, 4, 4)
[node name="Relay" type="RemoteTransform2D" parent="."]
position = Vector2(100, 0)
remote_path = NodePath("../Props")
`;

  it('carries the item lifted past it to the ancestor’s moved place', async () => {
    const { sceneGraph } = parseTscnContent(SORTED, 'res://main.tscn');
    const renderer = await ReactThreeTestRenderer.create(
      <DispatchedScene sceneGraph={sceneGraph!} loader={loaderServing({})} workspace="2d" />
    );
    await settleLoads();

    let marker: THREE.Object3D | undefined;
    instanceAs<THREE.Object3D>(renderer.scene).traverse((o) => {
      if (o.name === 'Marker') marker = o;
    });
    marker!.updateWorldMatrix(true, false);
    // The relay moves Props to x = 100, so the marker at 5 into Props stands at 105.
    expect(marker!.getWorldPosition(new THREE.Vector3()).x).toBeCloseTo(105, 3);
  });
});

describe("a relay cycle under the project's physics clock", () => {
  // Godot drew the box at x 2991 with `physics_ticks_per_second=120`, two pushes behind 2993.
  const CYCLE = `[gd_scene load_steps=2 format=3]
[sub_resource type="BoxMesh" id="Box"]
[node name="Root" type="Node3D"]
[node name="HolderA" type="Node3D" parent="."]
[node name="Box" type="MeshInstance3D" parent="HolderA"]
mesh = SubResource("Box")
[node name="RelayA" type="RemoteTransform3D" parent="HolderA"]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 1, 0, 0)
remote_path = NodePath("../../HolderB")
[node name="HolderB" type="Node3D" parent="."]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 3)
[node name="RelayB" type="RemoteTransform3D" parent="HolderB"]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 1, 0, 0)
remote_path = NodePath("../../HolderA")
`;

  it('draws the mesh where the project ticks it by the harness frame', async () => {
    const { sceneGraph, error } = parseTscnContent(CYCLE, 'res://main.tscn');
    if (!sceneGraph) throw new Error(`expected a scene, got ${error}`);
    const loader = loaderServing({
      'res://project.godot': 'config_version=5\n\n[physics]\n\ncommon/physics_ticks_per_second=120\n',
    });
    const renderer = await ReactThreeTestRenderer.create(
      <DispatchedScene
        sceneGraph={sceneGraph}
        loader={loader}
        around={(nodes) => (
          <ProjectSettingsProvider sceneKey="res://main.tscn">{nodes}</ProjectSettingsProvider>
        )}
      />
    );
    await settleLoads();

    expect(meshWorldXs(renderer)).toEqual([expect.closeTo(2991, 3)]);
  });
});
