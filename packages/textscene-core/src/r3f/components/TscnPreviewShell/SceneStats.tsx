import { useCallback, useSyncExternalStore } from 'react';
import type { NodeHandle } from '../../../scene/nodeHandle.js';
import type { Scene } from '../../../scene/openScene.js';
import { ROOT_WINDOW_PATH } from '../../../scene/nodePathWalk.js';
import { isCamera3DType } from '../../cameraNodeTypes.js';
import styles from './TscnPreviewShell.module.css';

/** The node count is authored, an instance counting once as in Godot's scene dock. */
export function SceneStats({ scene }: { scene: Scene }) {
  const nodeCount = useAuthoredNodeCount(scene);
  const cameraCount = useCamera3DCount(scene);
  if (nodeCount === null) return null;
  return (
    <div className={styles.statChips} role="group" aria-label="Scene info">
      <span className={styles.statChip} data-testid="scene-info-nodes">{`${nodeCount} nodes`}</span>
      {cameraCount > 0 && (
        <span
          className={styles.statChip}
        >{`${cameraCount} ${cameraCount === 1 ? 'camera' : 'cameras'}`}</span>
      )}
    </div>
  );
}

/** Node-count badge for the Scene Tree dock header. */
export function SceneNodeCount({ scene }: { scene: Scene }) {
  const nodeCount = useAuthoredNodeCount(scene);
  if (nodeCount === null) return null;
  return <span className={styles.dockCount}>{nodeCount} nodes</span>;
}

/** Null before the host has sent a scene. */
function useAuthoredNodeCount(scene: Scene): number | null {
  return useSyncExternalStore(scene.subscribe, () => scene.parse().sceneGraph?.flattenedNodes.length ?? null);
}

function useCamera3DCount(scene: Scene): number {
  const observeTree = useCallback((listener: () => void) => scene.observe(null, listener), [scene]);
  return useSyncExternalStore(observeTree, () => camera3DCountUnder(scene.getNodeOrNull(ROOT_WINDOW_PATH)));
}

function camera3DCountUnder(node: NodeHandle | null): number {
  if (!node) return 0;
  const own = isCamera3DType(node.type) ? 1 : 0;
  return node.getChildren().reduce((count, child) => count + camera3DCountUnder(child), own);
}
