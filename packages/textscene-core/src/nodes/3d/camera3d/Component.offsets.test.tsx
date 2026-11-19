import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import type { TscnNode } from '../../../parser/types';
import { identityTransform3D } from '../../../godot/math/transform3d';
import { instanceAs } from '../testing/reactThreeTestInstance';
import { makeCameraNode } from './cameraNode.testkit';
import { Camera3DInWorld } from './Camera3DInWorld.testkit';

interface Parent {
  turn?: number;
  scale?: [number, number, number];
}

const rounded = (values: number[]) => values.map((value) => Number(value.toFixed(6)) + 0);

/** The camera the renderer draws through, with its node under a parent turned about Y and scaled. */
async function renderedCamera(node: TscnNode, { turn = 0, scale = [1, 1, 1] }: Parent = {}) {
  const renderer = await ReactThreeTestRenderer.create(
    <group rotation={[0, turn, 0]} scale={scale}>
      <Camera3DInWorld node={node} />
    </group>
  );
  (renderer.scene.instance as THREE.Object3D).updateMatrixWorld(true);
  return instanceAs<THREE.Camera>(renderer.scene.findByType('PerspectiveCamera'));
}

async function cameraWorldPosition(node: TscnNode, parent?: Parent): Promise<number[]> {
  const camera = await renderedCamera(node, parent);
  return rounded(new THREE.Vector3().setFromMatrixPosition(camera.matrixWorld).toArray());
}

describe('<Camera3D> h_offset and v_offset (camera_3d.cpp:253-258)', () => {
  it('move a camera that has no transform along its right and up axes', async () => {
    const node = makeCameraNode({ h_offset: 0.6, v_offset: -0.4 });

    expect(await cameraWorldPosition(node)).toEqual([0.6, -0.4, 0]);
  });

  it('move along the axes a turned parent gives the camera', async () => {
    const node = makeCameraNode({ h_offset: 1 });

    expect(await cameraWorldPosition(node, { turn: Math.PI / 2 })).toEqual([0, 0, -1]);
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

  it('move along the right column of a turned camera, as the rows of its transform give it', async () => {
    const yawed = {
      basis_x: { x: 0, y: 0, z: -1 },
      basis_y: { x: 0, y: 1, z: 0 },
      basis_z: { x: 1, y: 0, z: 0 },
      origin: { x: 0, y: 0, z: 5 },
    };
    const node = makeCameraNode({ transform: yawed, h_offset: 2, v_offset: 1 });

    expect(await cameraWorldPosition(node)).toEqual([0, 1, 7]);
  });

  it('move in metres under a uniformly scaled parent', async () => {
    const node = makeCameraNode({ h_offset: 1 });

    expect(await cameraWorldPosition(node, { scale: [2, 2, 2] })).toEqual([1, 0, 0]);
  });

  it('move in metres under a non-uniformly scaled, turned parent', async () => {
    const node = makeCameraNode({ h_offset: 1, v_offset: 1 });

    expect(await cameraWorldPosition(node, { turn: Math.PI / 2, scale: [3, 2, 1] })).toEqual([0, 1, -1]);
  });

  it('move along the mirrored axis under a negatively scaled parent', async () => {
    const node = makeCameraNode({ h_offset: 1 });

    expect(await cameraWorldPosition(node, { scale: [-2, 1, 1] })).toEqual([-1, 0, 0]);
  });
});

describe('<Camera3D> view under a scaled parent (camera_3d.cpp:253)', () => {
  it('draws through an orthonormal transform, as the scale leaves the view', async () => {
    const camera = await renderedCamera(makeCameraNode(), { scale: [3, 2, 1] });

    const inverse = camera.matrixWorld.clone().invert();
    expect(rounded(camera.matrixWorldInverse.toArray())).toEqual(rounded(inverse.toArray()));
    expect(rounded(new THREE.Vector3().setFromMatrixScale(camera.matrixWorld).toArray())).toEqual([1, 1, 1]);
  });
});
