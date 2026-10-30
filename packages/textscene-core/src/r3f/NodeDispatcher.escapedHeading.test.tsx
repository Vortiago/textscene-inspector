/**
 * A host heading whose `parent=` walk leaves the instance it enters draws where the walk ends,
 * under the node it names, not under the instance (packed_scene.cpp:157-165). The heading sits in
 * an instanced file, so the instance that hands it back loads after the file does.
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { TscnParser } from '../parser/TscnParser';
import { createFakeResourceLoader } from '../resources/testing/createFakeResourceLoader';
import { NodeDispatcher } from './NodeDispatcher';
import { SceneStack } from './testing/SceneStack';
import { settleLoads } from './testing/settleLoads';

import './nodes/index';
import '../nodes/node/index';
import '../nodes/base/node3d/index';
import '../nodes/3d/meshinstance3d/index';

const parse = (text: string) => new TscnParser().parse(text);

const HUD = parse(`[gd_scene format=3]

[node name="Hud" type="Node3D"]
`);

/** HudInstance's table lacks `%Lamp`, so Shade seats under Lamp, at (1.5, 1, 0). */
const STAGE = parse(`[gd_scene format=3]

[ext_resource type="PackedScene" path="res://hud.tscn" id="hud"]

[sub_resource type="BoxMesh" id="Box"]

[node name="Stage" type="Node3D"]

[node name="HudInstance" parent="." instance=ExtResource("hud")]

[node name="Lamp" type="Node3D" parent="."]
unique_name_in_owner = true
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 1.5, 0, 0)

[node name="Shade" type="MeshInstance3D" parent="HudInstance/%Lamp"]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 0)
mesh = SubResource("Box")
`);

const OUTER = parse(`[gd_scene format=3]

[ext_resource type="PackedScene" path="res://stage.tscn" id="stage"]

[node name="Outer" type="Node3D"]

[node name="StageInstance" parent="." instance=ExtResource("stage")]
`);

async function shadePosition(): Promise<THREE.Vector3> {
  const fake = createFakeResourceLoader();
  fake.scenes.seed('res://hud.tscn', HUD);
  fake.scenes.seed('res://stage.tscn', STAGE);
  const renderer = await ReactThreeTestRenderer.create(
    <SceneStack loader={fake.loader} scene={OUTER}>
      <NodeDispatcher nodes={OUTER.nodes} />
    </SceneStack>
  );
  await settleLoads();
  const [shade] = renderer.scene.findAllByType('Mesh');
  return (shade!.instance as THREE.Object3D).getWorldPosition(new THREE.Vector3());
}

describe('<NodeDispatcher> over a heading that leaves an instance of an instanced file', () => {
  it('draws the heading under the node where its walk ends', async () => {
    expect((await shadePosition()).toArray()).toEqual([1.5, 1, 0]);
  });
});
