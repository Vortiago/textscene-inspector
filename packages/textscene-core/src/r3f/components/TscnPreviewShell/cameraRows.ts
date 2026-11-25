import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { useOptionalHierarchy } from '../../contexts/HierarchyContext.js';
import { useSceneCameras, useSceneTreeSubscription } from '../../currentCamera.js';
import { absolutePathOf } from '../../../scene/nodePathWalk.js';
import type { CameraState } from '../../../scene/viewportCameras.js';
import type { Scene } from '../../../scene/openScene.js';
import * as logger from '../../../logger.js';

/** A camera of the scene as the panel lists it: its state, its name and its kind. */
export interface CameraRow extends CameraState {
  readonly name: string;
  readonly dimension: '3D' | '2D';
}

type CameraKind = Pick<CameraRow, 'name' | 'dimension'>;

/** The cameras in the order they enter the tree, kinds read with `is_class`. Null until the reads land. */
export function useCameraRows(): readonly CameraRow[] | null {
  const scene = useOptionalHierarchy()?.scene;
  const states = useSceneCameras();
  const kinds = useCameraKinds(scene, [...states.keys()].join('\n'));
  if (!kinds) return null;
  return [...states.values()].flatMap((state) => {
    const kind = kinds.get(state.path);
    return kind ? [{ ...state, ...kind }] : [];
  });
}

/** Read again only for a new text or a camera that enters or leaves, so a current switch reads nothing. */
function useCameraKinds(scene: Scene | undefined, pathList: string): ReadonlyMap<string, CameraKind> | null {
  const paths = useMemo(() => (pathList ? pathList.split('\n') : []), [pathList]);
  const parse = useSyncExternalStore(useSceneTreeSubscription(scene), () => scene?.parse() ?? null);
  const [kinds, setKinds] = useState<ReadonlyMap<string, CameraKind> | null>(null);
  useEffect(() => {
    let isLatest = true;
    const read = scene ? Promise.all(paths.map((path) => kindOf(scene, path))) : NO_KINDS;
    read
      .then((next) => {
        if (isLatest)
          setKinds(new Map(paths.flatMap((path, index) => (next[index] ? [[path, next[index]]] : []))));
      })
      .catch((error: unknown) =>
        logger.error(`expected the cameras of the scene to read, got ${String(error)}`)
      );
    return () => {
      isLatest = false;
    };
  }, [scene, paths, parse]);
  return kinds;
}

const NO_KINDS = Promise.resolve([]);

/** Null for a camera a new text frees before or during its read. */
async function kindOf(scene: Scene, path: string): Promise<CameraKind | null> {
  const camera = scene.getNodeOrNull(absolutePathOf(path));
  if (!camera) return null;
  try {
    const is3D = (await camera.call('is_class', 'Camera3D')) === true;
    return { name: camera.name, dimension: is3D ? '3D' : '2D' };
  } catch (error) {
    // A new text frees the camera during the read, and the rows read again over the new cameras.
    if (!camera.isInsideTree()) return null;
    throw error;
  }
}
