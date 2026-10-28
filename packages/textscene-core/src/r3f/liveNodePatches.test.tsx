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
