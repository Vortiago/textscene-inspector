/**
 * `useBillboard` runs `applyBillboard` on every frame. `nodeBillboard.test.ts` pins the basis it
 * writes; these pin that the hook reaches it with the rendering camera and the node's mode.
 */
import { afterEach, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { useLayoutEffect, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { BillboardMode } from '../../godot/scene/billboard';
import { useBillboard } from './useBillboard';

type Mounted = { object: THREE.Object3D; camera: THREE.Camera };

function Billboarded({ mode, onMount }: { mode: number; onMount: (mounted: Mounted) => void }) {
  const ref = useRef<THREE.Object3D>(null);
  const camera = useThree((state) => state.camera);
  useLayoutEffect(() => {
    camera.position.set(0, 0, 10);
    camera.rotation.set(0.2, 0.4, 0);
    onMount({ object: ref.current!, camera });
  }, [camera, onMount]);
  useBillboard(ref, mode);
  return (
    <group rotation={[0, Math.PI / 3, 0]}>
      <object3D ref={ref} />
    </group>
  );
}

let renderer: Awaited<ReturnType<typeof ReactThreeTestRenderer.create>> | undefined;

afterEach(async () => {
  await renderer?.unmount();
  renderer = undefined;
});

/** The billboarded node and the camera after one rendered frame. */
async function billboarded(mode: number): Promise<Mounted> {
  let mounted: Mounted | undefined;
  renderer = await ReactThreeTestRenderer.create(<Billboarded mode={mode} onMount={(m) => (mounted = m)} />);
  await renderer.advanceFrames(1, 16);
  return mounted!;
}

describe('useBillboard', () => {
  it('faces the rendering camera on a rendered frame', async () => {
    const { object, camera } = await billboarded(BillboardMode.BILLBOARD_ENABLED);

    const objectZ = new THREE.Vector3().setFromMatrixColumn(object.matrixWorld, 2);
    const cameraZ = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 2);
    expect(objectZ.distanceTo(cameraZ)).toBeCloseTo(0, 6);
    expect(object.matrixWorldAutoUpdate).toBe(false);
  });

  it('leaves a DISABLED node to three', async () => {
    const { object } = await billboarded(BillboardMode.BILLBOARD_DISABLED);

    expect(object.matrixWorldAutoUpdate).toBe(true);
  });
});
