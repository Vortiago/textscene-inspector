import { useEffect, useState } from 'react';
import { useOptionalHierarchy } from '../../contexts/HierarchyContext.js';
import { useSceneCameras } from '../../currentCamera.js';
import { absolutePathOf } from '../../../scene/nodePathWalk.js';
import type { CameraState } from '../../../scene/viewportCameras.js';
import type { Scene } from '../../../scene/openScene.js';
import * as logger from '../../../logger.js';

/** A camera of the scene as the panel lists it: its state, its name and its kind. */
export interface CameraRow extends CameraState {
  readonly name: string;
  readonly dimension: '3D' | '2D';
}

/** The cameras in the order they enter the tree, each kind read with `is_class` once the reads land. */
export function useCameraRows(): readonly CameraRow[] {
  const scene = useOptionalHierarchy()?.scene;
  const states = useSceneCameras();
  const [rows, setRows] = useState<readonly CameraRow[]>([]);
  useEffect(() => {
    let isLatest = true;
    const read = scene ? Promise.all([...states.values()].map((state) => rowOf(scene, state))) : NO_ROWS;
    read
      .then((next) => {
        if (isLatest) setRows(next.flatMap((row) => row ?? []));
      })
      .catch((error: unknown) =>
        logger.error(`expected the cameras of the scene to read, got ${String(error)}`)
      );
    return () => {
      isLatest = false;
    };
  }, [scene, states]);
  return rows;
}

const NO_ROWS = Promise.resolve([]);

/** Null for a camera a new text freed before its read. */
async function rowOf(scene: Scene, state: CameraState): Promise<CameraRow | null> {
  const camera = scene.getNodeOrNull(absolutePathOf(state.path));
  if (!camera) return null;
  const is3D = (await camera.call('is_class', 'Camera3D')) === true;
  return { ...state, name: camera.name, dimension: is3D ? '3D' : '2D' };
}
