import { useOptionalHierarchy } from '../../contexts/HierarchyContext.js';
import { absolutePathOf } from '../../../scene/nodePathWalk.js';
import type { CameraState } from '../../../scene/viewportCameras.js';
import type { Scene } from '../../../scene/openScene.js';
import * as logger from '../../../logger.js';
import type { CameraRow } from './cameraRows.js';
import styles from './TscnPreviewShell.module.css';

function tagOf({ isCurrent, canBeCurrent, viewport }: CameraState): string {
  const state = isCurrent ? 'current' : canBeCurrent ? 'make current' : 'not enabled';
  return viewport === null ? state : `${state} · ${viewport}`;
}

/** Logs a refused call, since a click handler has no caller to hand the error to. */
async function makeCurrent(scene: Scene, path: string): Promise<void> {
  try {
    await scene.getNode(absolutePathOf(path)).call('make_current');
  } catch (error) {
    logger.error(`expected make_current of the camera at ${path} to run, got ${String(error)}`);
  }
}

interface GameCameraRowsProps {
  cameras: readonly CameraRow[];
}

/** The In-game rows: each viewport's current camera, moved by `make_current` as outside code moves it. */
export function GameCameraRows({ cameras }: GameCameraRowsProps) {
  const scene = useOptionalHierarchy()?.scene;
  return (
    <div className={styles.camList}>
      {cameras.map((camera) => (
        <button
          key={camera.path}
          type="button"
          className={styles.camRow}
          data-active={camera.isCurrent}
          disabled={!camera.canBeCurrent}
          onClick={() => {
            if (scene) void makeCurrent(scene, camera.path);
          }}
        >
          <span className={styles.camName}>{camera.name}</span>
          <span className={styles.camTag}>{tagOf(camera)}</span>
        </button>
      ))}
    </div>
  );
}
