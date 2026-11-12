/** The axes of the camera that renders, which a particle node reads to sort or turn its instances. */

import { useState } from 'react';
import { useFrame } from '@react-three/fiber';
import type { CameraAxes } from '../gpuparticles/instanceCopy';

/**
 * The camera's global `basis.get_column(2)` and `get_column(1)` (`particles_storage.cpp:1293-1295`),
 * read each frame while `isRead`, else null. Godot copies the instances again for a moved camera, so
 * a moved camera changes the result.
 */
export function useCameraAxes(isRead: boolean): CameraAxes | null {
  const [axes, setAxes] = useState<CameraAxes | null>(null);
  useFrame(({ camera }) => {
    if (!isRead) return;
    const e = camera.matrixWorld.elements;
    const axis = { x: e[8]!, y: e[9]!, z: e[10]! };
    const up = { x: e[4]!, y: e[5]!, z: e[6]! };
    if (axes && sameVector(axes.axis, axis) && sameVector(axes.up, up)) return;
    setAxes({ axis, up });
  });
  return isRead ? axes : null;
}

function sameVector(a: CameraAxes['axis'], b: CameraAxes['axis']): boolean {
  return a.x === b.x && a.y === b.y && a.z === b.z;
}
