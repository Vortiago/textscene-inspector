import { useOptionalHierarchy } from '../../contexts/HierarchyContext.js';
import { useSceneCameras } from '../../currentCamera.js';
import type { LiveTreeEntry } from '../../liveSceneTree.js';
import { ROOT_WINDOW_PATH } from '../../../scene/nodePathWalk.js';
import type { CameraState } from '../../../scene/viewportCameras.js';
import styles from './TscnPreviewShell.module.css';

function tagOf({ isCurrent, canBeCurrent, viewport }: CameraState): string {
  const state = isCurrent ? 'current' : canBeCurrent ? 'make current' : 'not enabled';
  return viewport === null ? state : `${state} · ${viewport.slice(viewport.lastIndexOf('/') + 1)}`;
}

interface GameCameraRowsProps {
  cameras: readonly LiveTreeEntry[];
}

/** The In-game rows: each viewport's current camera, moved by `make_current` as outside code moves it. */
export function GameCameraRows({ cameras }: GameCameraRowsProps) {
  const scene = useOptionalHierarchy()?.scene;
  const states = useSceneCameras();

  function makeCurrent(path: string) {
    void scene
      ?.getNode(`${ROOT_WINDOW_PATH}/${path}`)
      .call('make_current')
      .catch((error: unknown) => {
        throw new Error(`make_current of the camera at ${path} failed: ${String(error)}`);
      });
  }

  return (
    <div className={styles.camList}>
      {cameras.map((camera) => {
        // A camera of a sub-scene that has not loaded is listed before the scene holds it.
        const state = states.get(camera.path);
        if (!state) return null;
        return (
          <button
            key={camera.path}
            type="button"
            className={styles.camRow}
            data-active={state.isCurrent}
            disabled={!state.canBeCurrent}
            onClick={() => makeCurrent(camera.path)}
          >
            <span className={styles.camName}>{camera.node.name}</span>
            <span className={styles.camTag}>{tagOf(state)}</span>
          </button>
        );
      })}
    </div>
  );
}
