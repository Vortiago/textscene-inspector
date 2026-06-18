/** Scene-count badges for the shell's top bar and dock header. */
import { useHierarchy } from '../../contexts/HierarchyContext.js';
import { useLiveSceneNodes } from '../../useLiveSceneTree.js';
import type { TscnNode } from '../../../parser/types.js';
import styles from './TscnPreviewShell.module.css';

/** Stable predicate so `useLiveSceneNodes`' memo doesn't recompute each render. */
const isCamera3D = (n: TscnNode): boolean => n.type === 'Camera3D';

/**
 * Compact scene stat chips for the top bar. Each chip's text is a single node
 * (e.g. "4 nodes", "2 cameras") so it never collides with the tree's node-name
 * elements that tests match via `findByText('Root')`.
 *
 * Node count is the AUTHORED count (`flattenedNodes` — instances counted as one,
 * matching Godot's collapsed scene dock). Camera count comes from the LIVE scene
 * tree so cameras inside instanced sub-scenes are included (consistent with the
 * Cameras panel).
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
