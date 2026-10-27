/**
 * A typed node added below a Skeleton3D or BoneAttachment3D of an instanced GLB rides with that
 * node: its transform and its visibility reach the node's children.
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import type { TscnNode } from '../../../parser/types';
import { parsedNode, translated } from '../../../parser/testing/parserKit';
import { NodeDispatcher } from '../../NodeDispatcher';
import { SceneStack } from '../../testing/SceneStack';
import { visibleInTree } from '../../visibleInTree';
import { createGLBMesh } from '../../../resources/formats/glb/glbProcessing';
import { NO_SIDECAR } from '../../../resources/formats/glb/testing/noSidecar';
import { RIG_GLB } from '../../../resources/formats/glb/testing/rigGlb';
import { createFakeResourceLoader } from '../../../resources/testing/createFakeResourceLoader';
import { seedGlbInstance } from '../../../resources/testing/seedGlbInstance';
import { settleLoads } from '../../testing/settleLoads';

import '../../nodes/index';
import '../../../nodes/node/index';
import '../../../nodes/base/node3d/index';
import '../../../nodes/3d/meshinstance3d/index';

const GLB_PATH = 'res://rig.glb';
const BOX_MESH = { id: 'Box', type: 'BoxMesh', data: {} };

/** A typed MeshInstance3D added below the node at `parentPath` of the GLB. */
const marker = (parentPath: string): TscnNode => ({
  ...parsedNode({ name: 'Marker', type: 'MeshInstance3D' }, { mesh: 'SubResource("Box")' }),
  instanceSubPath: parentPath,
});

/** A type-less override of the Skeleton3D, as `[node name="Skeleton3D" parent="Rig/Armature" index="0"]` writes it. */
const skeletonOverride = (raw: Record<string, string>, transform?: string): TscnNode => ({
  ...parsedNode({ name: 'Skeleton3D', type: 'Node3D' }, { ...raw, ...(transform ? { transform } : {}) }),
  type: '',
  instanceSubPath: 'Armature',
  overridesExistingNode: true,
});

async function renderRig(children: TscnNode[]) {
  const fake = createFakeResourceLoader();
  seedGlbInstance(fake, GLB_PATH, await createGLBMesh(RIG_GLB, NO_SIDECAR));
  const instance: TscnNode = {
    ...parsedNode({ name: 'Rig', type: 'Node', instance: 'ExtResource("rig")' }),
    children,
  };
  const renderer = await ReactThreeTestRenderer.create(
    <SceneStack
      loader={fake.loader}
      scene={{
        internalResources: [BOX_MESH],
        externalResources: [{ id: 'rig', path: GLB_PATH, type: 'PackedScene' }],
      }}
    >
      <NodeDispatcher nodes={[instance]} />
    </SceneStack>
  );
  await settleLoads();
  renderer.scene.instance.updateMatrixWorld(true);
  return renderer;
}

function markerMesh(renderer: Awaited<ReturnType<typeof renderRig>>): THREE.Object3D {
  const mesh = renderer.scene.instance.getObjectByName('Marker');
  expect(mesh, 'the added node should be mounted').toBeDefined();
  return mesh!;
}

describe('GLBSceneRoot — a node added below a Skeleton3D', () => {
  it('moves with the transform the instancing scene gives the Skeleton3D', async () => {
    const renderer = await renderRig([
      marker('Armature/Skeleton3D'),
      skeletonOverride({}, translated(0, 2, 0)),
    ]);

    expect(markerMesh(renderer).getWorldPosition(new THREE.Vector3()).toArray()).toEqual([0, 2, 0]);
  });

  it('is hidden with the Skeleton3D', async () => {
    const renderer = await renderRig([marker('Armature/Skeleton3D'), skeletonOverride({ visible: 'false' })]);

    expect(visibleInTree(markerMesh(renderer))).toBe(false);
  });

  it('hides the skinned mesh the GLB holds beside its bones', async () => {
    const renderer = await renderRig([skeletonOverride({ visible: 'false' })]);

    expect(visibleInTree(renderer.scene.instance.getObjectByName('Body')!)).toBe(false);
  });

  it('is drawn when a BoneAttachment3D beside it is hidden', async () => {
    const hiddenAttachment: TscnNode = {
      ...skeletonOverride({ visible: 'false' }),
      name: 'Hip',
      instanceSubPath: 'Armature/Skeleton3D',
    };

    const renderer = await renderRig([marker('Armature/Skeleton3D'), hiddenAttachment]);

    expect(visibleInTree(markerMesh(renderer))).toBe(true);
  });
});

describe('GLBSceneRoot — a node added below a BoneAttachment3D', () => {
  it('is hidden with the BoneAttachment3D', async () => {
    const hiddenAttachment: TscnNode = {
      ...skeletonOverride({ visible: 'false' }),
      name: 'Hip',
      instanceSubPath: 'Armature/Skeleton3D',
    };

    const renderer = await renderRig([marker('Armature/Skeleton3D/Hip'), hiddenAttachment]);

    expect(visibleInTree(markerMesh(renderer))).toBe(false);
  });
});
