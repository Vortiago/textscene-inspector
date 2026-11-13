/** The axes of the camera that renders, which a particle node reads to sort or turn its instances. */

import { useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { sameVector3 } from '../../../godot/math/transform3d';
import type { Vector3 } from '../../../godot/math/vector';

/** The camera's global `basis.get_column(2)` and `get_column(1)` (`particles_storage.cpp:1293-1295`). */
export interface CameraAxes {
  axis: Vector3;
  up: Vector3;
}

/** The camera's axes, read each frame while `isRead`, else null. A moved camera gives a new value. */
export function useCameraAxes(isRead: boolean): CameraAxes | null {
  const [axes, setAxes] = useState<CameraAxes | null>(null);
  useFrame(({ camera }) => {
    if (!isRead) return;
    const e = camera.matrixWorld.elements;
    const axis = { x: e[8]!, y: e[9]!, z: e[10]! };
    const up = { x: e[4]!, y: e[5]!, z: e[6]! };
    if (axes && sameVector3(axes.axis, axis) && sameVector3(axes.up, up)) return;
    setAxes({ axis, up });
  });
  return isRead ? axes : null;
}
