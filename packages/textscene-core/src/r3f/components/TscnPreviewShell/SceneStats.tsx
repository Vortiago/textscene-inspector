/** Scene-count badges for the shell's top bar and dock header. */
import { useHierarchy } from '../../contexts/HierarchyContext.js';
import { useLiveSceneNodes } from '../../useLiveSceneTree.js';
import type { TscnNode } from '../../../parser/types.js';
import { isCamera3DType } from '../../cameraNodeTypes.js';
import styles from './TscnPreviewShell.module.css';

/** A stable predicate, so the memo of `useLiveSceneNodes` does not recompute each render. */
const isCamera3D = (n: TscnNode): boolean => isCamera3DType(n.type);

/**
 * Each chip's text is one node, such as "4 nodes", so it never matches a tree
 * row's `findByText`. The node count is authored, an instance counting once as
 * in Godot's scene dock. The camera count reads the live scene tree.
 */
export function SceneStats() {
  const { sceneGraph } = useHierarchy();
  const cameras = useLiveSceneNodes(isCamera3D);
  if (sceneGraph === null) return null;
  const nodeCount = sceneGraph.flattenedNodes.length;
  const cameraCount = cameras.length;
  return (
    <div className={styles.statChips} role="group" aria-label="Scene info">
      <span className={styles.statChip} data-testid="scene-info-nodes">{`${nodeCount} nodes`}</span>
      {cameraCount > 0 && (
        <span className={styles.statChip}>{`${cameraCount} ${cameraCount === 1 ? 'camera' : 'cameras'}`}</span>
      )}
    </div>
  );
}

/** Node-count badge for the Scene Tree dock header. */
export function SceneNodeCount() {
  const { sceneGraph } = useHierarchy();
  if (sceneGraph === null) return null;
  return <span className={styles.dockCount}>{sceneGraph.flattenedNodes.length} nodes</span>;
}
