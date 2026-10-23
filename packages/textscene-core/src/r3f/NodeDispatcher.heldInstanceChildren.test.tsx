/**
 * An override of an instanced scene's node, `[node name="Torso" parent="."]`, is no node of the
 * instancing scene: Godot takes the existing node by name (`packed_scene.cpp:280-283`). While the
 * instanced scene is unknown, or missing, nothing can take it, so it and what is written below it
 * draw nothing. A missing instance is a `MissingNode` in the editor (`packed_scene.cpp:267-269`),
 * and a node it cannot find is skipped (`:310`). The host's own children hang below it.
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import type { TscnNode } from '../parser/types';
import { parsedNode } from '../parser/testing/parserKit';
import { createFakeResourceLoader } from '../resources/testing/createFakeResourceLoader';
import { seedGlbInstance } from '../resources/testing/seedGlbInstance';
import { NodeDispatcher } from './NodeDispatcher';
import { SceneStack } from './testing/SceneStack';
import { settleLoads } from './testing/settleLoads';

import './nodes/index';
import '../nodes/node/index';
import '../nodes/base/node3d/index';
import '../nodes/3d/meshinstance3d/index';

const GLB_PATH = 'res://rig.glb';
const BOX_MESH = { id: 'Box', type: 'BoxMesh', data: {} };

const mesh = (name: string): TscnNode =>
  parsedNode({ name, type: 'MeshInstance3D' }, { mesh: 'SubResource("Box")' });

/** `[node name="Torso" parent="."]` with a mesh written below it, as the scene tree builder nests it. */
function overrideWithChild(): TscnNode {
  return {
    ...parsedNode({ name: 'Torso', type: 'Node3D' }, {}),
    type: '',
    overridesExistingNode: true,
    children: [mesh('Hat')],
  };
}

const rig: TscnNode = {
  ...parsedNode({ name: 'Rig', type: 'Node', instance: 'ExtResource("rig")' }, {}),
  children: [overrideWithChild(), mesh('Direct')],
};

/** The names of the nodes the render mounts a mesh for, in the order found. */
async function drawnMeshes(prepare: (fake: ReturnType<typeof createFakeResourceLoader>) => void) {
  const fake = createFakeResourceLoader();
  prepare(fake);
  const renderer = await ReactThreeTestRenderer.create(
    <SceneStack
      loader={fake.loader}
      scene={{
        internalResources: [BOX_MESH],
        externalResources: [{ id: 'rig', path: GLB_PATH, type: 'PackedScene' }],
      }}
    >
      <NodeDispatcher nodes={[rig]} />
    </SceneStack>
  );
  await settleLoads();
  return [...new Set(renderer.scene.findAllByType('Mesh').map((m) => m.instance as THREE.Object3D))];
}

describe('an instance whose scene is not loaded', () => {
  it('draws only the host child, not the override or what is written below it, while it loads', async () => {
    const meshes = await drawnMeshes(() => {});

    expect(meshes).toHaveLength(1);
  });

  it('draws the host child and the missing-instance box when the load fails', async () => {
    const meshes = await drawnMeshes((fake) => fake.scenes.seed(GLB_PATH, null));

    expect(meshes).toHaveLength(2);
  });

  it('draws the host child once the GLB is loaded', async () => {
    const meshes = await drawnMeshes((fake) => seedGlbInstance(fake, GLB_PATH, new THREE.Group()));

    expect(meshes).toHaveLength(1);
  });
});
