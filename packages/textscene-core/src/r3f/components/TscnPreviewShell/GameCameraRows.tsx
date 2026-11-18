import { useOptionalHierarchy } from '../../contexts/HierarchyContext.js';
import { ROOT_VIEWPORT_PATH } from '../../contexts/EnclosingViewportContext.js';
import { useCurrentCameraPaths } from '../../currentCamera.js';
import { isCamera2DType } from '../../cameraNodeTypes.js';
import type { LiveTreeEntry } from '../../liveSceneTree.js';
import type { Camera2DProperties } from '../../../nodes/2d/camera2d/types.js';
import styles from './TscnPreviewShell.module.css';

/** The scene names the root window `/root`, and a live path starts at the scene's root node. */
const ROOT_WINDOW_PREFIX = '/root/';

/** `make_current` refuses a Camera2D that is not enabled (`camera_2d.cpp:585`), so its row takes no click. */
function canBeCurrent(camera: LiveTreeEntry): boolean {
  return (
    !isCamera2DType(camera.node.type) || (camera.node.properties as Camera2DProperties).enabled !== false
  );
}

/** The viewport whose current camera `camera` can be: the nearest viewport above it, else the root window. */
function viewportOf(camera: LiveTreeEntry, viewportPaths: readonly string[]): string {
  const enclosing = viewportPaths.filter((viewport) => camera.path.startsWith(`${viewport}/`));
  return enclosing.reduce(
    (nearest, viewport) => (viewport.length > nearest.length ? viewport : nearest),
    ROOT_VIEWPORT_PATH
  );
}

interface GameCameraRowsProps {
  cameras: readonly LiveTreeEntry[];
  viewportPaths: readonly string[];
}

/** The In-game rows: each viewport's current camera, moved by `make_current` as outside code moves it. */
export function GameCameraRows({ cameras, viewportPaths }: GameCameraRowsProps) {
  const scene = useOptionalHierarchy()?.scene;
  const viewports = [ROOT_VIEWPORT_PATH, ...viewportPaths];
  const currentPaths = useCurrentCameraPaths(viewports);

  function makeCurrent(path: string) {
    void scene
      ?.getNode(`${ROOT_WINDOW_PREFIX}${path}`)
      .call('make_current')
      .catch((error: unknown) => {
        throw new Error(`make_current of the camera at ${path} failed: ${String(error)}`);
      });
  }

  return (
    <div className={styles.camList}>
      {cameras.map((camera) => {
        const isCurrent = currentPaths.has(camera.path);
        const viewport = viewportOf(camera, viewportPaths);
        const isEnabled = canBeCurrent(camera);
        const viewportName = viewport.slice(viewport.lastIndexOf('/') + 1);
        return (
          <button
            key={camera.path}
            type="button"
            className={styles.camRow}
            data-active={isCurrent}
            disabled={!isEnabled}
            onClick={() => makeCurrent(camera.path)}
          >
            <span className={styles.camName}>{camera.node.name}</span>
            <span className={styles.camTag}>
              {isCurrent ? 'current' : isEnabled ? 'make current' : 'not enabled'}
              {viewport === ROOT_VIEWPORT_PATH ? '' : ` · ${viewportName}`}
            </span>
          </button>
        );
      })}
    </div>
  );
}
