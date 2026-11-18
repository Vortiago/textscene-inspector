import { useOptionalHierarchy } from '../../contexts/HierarchyContext.js';
import { useSceneCameras } from '../../currentCamera.js';
import type { LiveTreeEntry } from '../../liveSceneTree.js';
import { ROOT_WINDOW_PATH } from '../../../scene/nodePathWalk.js';
import type { CameraState } from '../../../scene/viewportCameras.js';
import type { Scene } from '../../../scene/openScene.js';
import * as logger from '../../../logger.js';
import styles from './TscnPreviewShell.module.css';

function tagOf({ isCurrent, canBeCurrent, viewport }: CameraState): string {
  const state = isCurrent ? 'current' : canBeCurrent ? 'make current' : 'not enabled';
  return viewport === null ? state : `${state} · ${viewport}`;
}

/** Logs a refused call, since a click handler has no caller to hand the error to. */
async function makeCurrent(scene: Scene, path: string): Promise<void> {
  try {
    await scene.getNode(`${ROOT_WINDOW_PATH}/${path}`).call('make_current');
  } catch (error) {
    logger.error(`expected make_current of the camera at ${path} to run, got ${String(error)}`);
  }
}

interface GameCameraRowsProps {
  cameras: readonly LiveTreeEntry[];
}

/** The In-game rows: each viewport's current camera, moved by `make_current` as outside code moves it. */
export function GameCameraRows({ cameras }: GameCameraRowsProps) {
  const scene = useOptionalHierarchy()?.scene;
  const states = useSceneCameras();

  // A camera of a sub-scene that has not loaded is listed before the scene holds it.
  const rows = cameras.flatMap((camera) => {
    const state = states.get(camera.path);
    return state ? [{ camera, state }] : [];
  });
  if (rows.length === 0) {
    return <div className={styles.emptyState}>No camera has entered the running scene.</div>;
  }
  return (
    <div className={styles.camList}>
      {rows.map(({ camera, state }) => {
        return (
          <button
            key={camera.path}
            type="button"
            className={styles.camRow}
            data-active={state.isCurrent}
            disabled={!state.canBeCurrent}
            onClick={() => {
              if (scene) void makeCurrent(scene, camera.path);
            }}
          >
            <span className={styles.camName}>{camera.node.name}</span>
            <span className={styles.camTag}>{tagOf(state)}</span>
          </button>
        );
      })}
    </div>
  );
}
