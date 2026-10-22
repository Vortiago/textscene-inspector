/**
 * A typed node an instancing scene attaches into a GLB belongs to the instancing scene's file, so
 * a `%Name` in its `visibility_parent` reads that file's table (`node.cpp:1930-1938`). Driven by
 * one scene render from 11 units.
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { createSceneGraphFromTscnScene } from '../../../core/SceneGraph.testkit';
import { TscnParser } from '../../../parser/TscnParser';
import { createFakeResourceLoader } from '../../../resources/testing/createFakeResourceLoader';
import { synthesiseGLBScene } from '../../../resources/processors/createSceneProcessor';
import { HierarchyProvider } from '../../contexts/HierarchyContext';
import { NodeDispatcher } from '../../NodeDispatcher';
import { SceneStack } from '../../testing/SceneStack';
import { manualCameraAt, renderScene } from '../../testing/renderScene';
import { drawsColour } from '../../testing/threePasses';

import '../../nodes/index';
import '../../../nodes/node/index';
import '../../../nodes/base/node3d/index';
import '../../../nodes/3d/meshinstance3d/index';

const GLB_PATH = 'res://rig.glb';

/** Proxy is a DEPENDENCIES range the camera is inside, and `Detail` names it as its visibility parent. */
const HOST = `[gd_scene format=3]

[ext_resource type="PackedScene" path="${GLB_PATH}" id="1"]

[sub_resource type="BoxMesh" id="Box"]

[node name="Root" type="Node3D"]

[node name="Proxy" type="MeshInstance3D" parent="."]
unique_name_in_owner = true
mesh = SubResource("Box")
visibility_range_begin = 5.0
visibility_range_fade_mode = 2

[node name="Rig" parent="." instance=ExtResource("1")]

[node name="Detail" type="MeshInstance3D" parent="Rig/Group"]
mesh = SubResource("Box")
visibility_parent = NodePath("%Proxy")
`;

async function renderDetail(): Promise<THREE.Mesh> {
  const scene = new TscnParser().parse(HOST);
  const fake = createFakeResourceLoader();
  fake.scenes.seed(GLB_PATH, synthesiseGLBScene(GLB_PATH));
  const glb = new THREE.Group();
  glb.add(Object.assign(new THREE.Group(), { name: 'Group' }));
  fake.glbMeshes.seed(GLB_PATH, glb);
  const camera = manualCameraAt({ x: 0.5, y: 0.5, z: 11 });
  const renderer = await ReactThreeTestRenderer.create(
    <HierarchyProvider value={{ sceneGraph: createSceneGraphFromTscnScene(scene), panelId: 'p' }}>
      <SceneStack loader={fake.loader} scene={scene}>
        <NodeDispatcher nodes={scene.nodes} />
      </SceneStack>
    </HierarchyProvider>,
    { camera }
  );
  await ReactThreeTestRenderer.act(async () => {
    await new Promise<void>((resolve) => setTimeout(resolve, 10));
  });
  await renderScene(renderer, camera);
  const meshes = renderer.scene.findAllByType('Mesh').map((mesh) => mesh.instance as THREE.Mesh);
  return meshes.find((mesh) => mesh.parent?.parent?.parent?.name === 'Group')!;
}

describe('a typed node attached into a GLB', () => {
  it('hides while the proxy its %Name visibility_parent names draws inside its range', async () => {
    expect(drawsColour(await renderDetail())).toBe(false);
  });
});
