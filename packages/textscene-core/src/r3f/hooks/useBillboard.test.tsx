/**
 * `useBillboard` against Godot's billboard shader basis: each case mounts a node under a parent,
 * places the default camera and advances one frame.
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { useLayoutEffect, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { BillboardMode } from '../../godot/scene/billboard';
import { useBillboard } from './useBillboard';

type Triple = [number, number, number];

interface Scene {
  mode: number;
  cameraPosition: Triple;
  cameraRotation: Triple;
  parentRotationY?: number;
  parentScale?: number;
  objectScale?: Triple;
  objectRotation?: Triple;
  autoUpdate?: boolean;
}

/** The node sits at local (0, 0, -4) under a parent at (1, 2, 3) with `parentRotationY` and `parentScale`. */
function Billboarded({
  scene,
  onMount,
}: {
  scene: Scene;
  onMount: (object: THREE.Object3D, camera: THREE.Camera) => void;
}) {
  const ref = useRef<THREE.Object3D>(null);
  const camera = useThree((state) => state.camera);
  useLayoutEffect(() => {
    camera.position.set(...scene.cameraPosition);
    camera.rotation.set(...scene.cameraRotation);
    onMount(ref.current!, camera);
  }, [camera, scene, onMount]);
  useBillboard(ref, scene.mode);
  return (
    <group position={[1, 2, 3]} rotation={[0, scene.parentRotationY ?? 0, 0]} scale={scene.parentScale ?? 1}>
      <object3D
        ref={ref}
        position={[0, 0, -4]}
        scale={scene.objectScale ?? [1, 1, 1]}
        rotation={scene.objectRotation ?? [0, 0, 0]}
        matrixWorldAutoUpdate={scene.autoUpdate ?? true}
      />
    </group>
  );
}

/** The billboarded node and the camera after one rendered frame. */
async function billboarded(scene: Scene): Promise<{ object: THREE.Object3D; camera: THREE.Camera }> {
  let mounted: { object: THREE.Object3D; camera: THREE.Camera } | undefined;
  const renderer = await ReactThreeTestRenderer.create(
    <Billboarded scene={scene} onMount={(object, camera) => (mounted = { object, camera })} />
  );
  await renderer.advanceFrames(1, 16);
  return mounted!;
}

const axis = (object: THREE.Object3D, column: 0 | 1 | 2) =>
  new THREE.Vector3().setFromMatrixColumn(object.matrixWorld, column);

const expectClose = (actual: THREE.Vector3, expected: [number, number, number]) => {
  expect(actual.x).toBeCloseTo(expected[0], 6);
  expect(actual.y).toBeCloseTo(expected[1], 6);
  expect(actual.z).toBeCloseTo(expected[2], 6);
};

describe('useBillboard', () => {
  it('builds FIXED_Y from the camera axes, not from the direction to the camera', async () => {
    // The camera sits off to +X but looks straight down -Z, so Godot's basis
    // (`material.cpp:1291-1295`) faces +Z. A yaw towards the camera would turn 90 degrees.
    const { object } = await billboarded({
      mode: BillboardMode.BILLBOARD_FIXED_Y,
      cameraPosition: [50, 0, 0],
      cameraRotation: [0, 0, 0],
      parentRotationY: Math.PI / 3,
    });

    expectClose(axis(object, 0), [1, 0, 0]);
    expectClose(axis(object, 1), [0, 1, 0]);
    expectClose(axis(object, 2), [0, 0, 1]);
  });

  it('keeps world up under FIXED_Y while the camera pitches', async () => {
    const { object } = await billboarded({
      mode: BillboardMode.BILLBOARD_FIXED_Y,
      cameraPosition: [0, 5, 5],
      cameraRotation: [-Math.PI / 4, 0, 0],
      parentRotationY: Math.PI / 3,
    });

    expectClose(axis(object, 1), [0, 1, 0]);
    expectClose(axis(object, 2), [0, 0, 1]);
  });

  it("takes the camera's basis under ENABLED whatever the parent's rotation", async () => {
    const { object, camera } = await billboarded({
      mode: BillboardMode.BILLBOARD_ENABLED,
      cameraPosition: [0, 0, 10],
      cameraRotation: [0.2, 0.4, 0],
      parentRotationY: Math.PI / 3,
    });

    const cameraZ = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 2);
    expectClose(axis(object, 2), [cameraZ.x, cameraZ.y, cameraZ.z]);
  });

  it('keeps the world scale of the node, as the sprite material sets billboard_keep_scale', async () => {
    // `get_material_for_2d` turns on FLAG_BILLBOARD_KEEP_SCALE with either mode (`material.cpp:3056-3058`).
    const { object } = await billboarded({
      mode: BillboardMode.BILLBOARD_ENABLED,
      cameraPosition: [0, 0, 10],
      cameraRotation: [0, 0, 0],
      parentScale: 2,
      objectScale: [1, 3, 1],
    });

    expect(axis(object, 0).length()).toBeCloseTo(2, 6);
    expect(axis(object, 1).length()).toBeCloseTo(6, 6);
  });

  it("keeps the node's world origin", async () => {
    const { object } = await billboarded({
      mode: BillboardMode.BILLBOARD_ENABLED,
      cameraPosition: [0, 0, 10],
      cameraRotation: [0, 0, 0],
      parentRotationY: Math.PI / 2,
    });

    // The parent turns local (0, 0, -4) to (-4, 0, 0) and moves it by (1, 2, 3).
    expectClose(new THREE.Vector3().setFromMatrixPosition(object.matrixWorld), [-3, 2, 3]);
  });

  it('stops three recomputing the world matrix it wrote', async () => {
    const { object } = await billboarded({
      mode: BillboardMode.BILLBOARD_ENABLED,
      cameraPosition: [0, 0, 10],
      cameraRotation: [0, 0, 0],
    });

    expect(object.matrixWorldAutoUpdate).toBe(false);
  });

  it('leaves a DISABLED node to three, with its own rotation', async () => {
    const { object } = await billboarded({
      mode: BillboardMode.BILLBOARD_DISABLED,
      cameraPosition: [0, 0, 10],
      cameraRotation: [0, 0, 0],
      objectRotation: [0, 1, 0],
      autoUpdate: false,
    });

    expect(object.matrixWorldAutoUpdate).toBe(true);
    expect(object.rotation.y).toBe(1);
  });
});
