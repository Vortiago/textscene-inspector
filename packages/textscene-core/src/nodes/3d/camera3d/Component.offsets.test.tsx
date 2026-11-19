import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import type { TscnNode } from '../../../parser/types';
import { identityTransform3D } from '../../../godot/math/transform3d';
import { instanceAs } from '../testing/reactThreeTestInstance';
import { makeCameraNode } from './cameraNode.testkit';
import { Camera3DInWorld } from './Camera3DInWorld.testkit';

/** The camera's world position, with its node under a parent turned by `parentTurn` about Y. */
async function cameraWorldPosition(node: TscnNode, parentTurn = 0): Promise<number[]> {
  const renderer = await ReactThreeTestRenderer.create(
    <group rotation={[0, parentTurn, 0]}>
      <Camera3DInWorld node={node} />
    </group>
  );
  const camera = instanceAs<THREE.Camera>(renderer.scene.findByType('PerspectiveCamera'));
  camera.updateWorldMatrix(true, false);
  const position = new THREE.Vector3().setFromMatrixPosition(camera.matrixWorld);
  return position.toArray().map((axis) => Number(axis.toFixed(6)));
}

describe('<Camera3D> h_offset and v_offset (camera_3d.cpp:253-258)', () => {
  it('move a camera that has no transform along its right and up axes', async () => {
    const node = makeCameraNode({ h_offset: 0.6, v_offset: -0.4 });

    expect(await cameraWorldPosition(node)).toEqual([0.6, -0.4, 0]);
  });

  it('move along the axes a turned parent gives the camera', async () => {
    const node = makeCameraNode({ h_offset: 1 });

    expect(await cameraWorldPosition(node, Math.PI / 2)).toEqual([0, 0, -1]);
  });

  it('move by the offset in metres whatever the scale of the camera', async () => {
    const scaled = { ...identityTransform3D(), basis_x: { x: 2, y: 0, z: 0 }, basis_y: { x: 0, y: 2, z: 0 } };
    const node = makeCameraNode({ transform: scaled, h_offset: 1, v_offset: 1 });

    expect(await cameraWorldPosition(node)).toEqual([1, 1, 0]);
  });

  it('move along the mirrored right axis of a mirrored camera', async () => {
    const mirrored = { ...identityTransform3D(), basis_x: { x: -1, y: 0, z: 0 } };
    const node = makeCameraNode({ transform: mirrored, h_offset: 1, v_offset: 1 });

    expect(await cameraWorldPosition(node)).toEqual([-1, 1, 0]);
  });
});
