/**
 * A whole-node billboard, applied per frame, for the nodes that own `billboard`: Sprite3D,
 * Label3D and the AudioStreamPlayer3D gizmo. A material's `billboard_mode` is per surface
 * instead (`surfaceDrawHooks.ts`).
 */

import { useFrame } from '@react-three/fiber';
import type * as THREE from 'three';
import type { RefObject } from 'react';
import { applyBillboard } from './nodeBillboard';

export function useBillboard(ref: RefObject<THREE.Object3D | null>, mode: number | undefined): void {
  useFrame(({ camera }) => {
    const object = ref.current;
    if (object) applyBillboard(object, camera, mode);
  });
}
