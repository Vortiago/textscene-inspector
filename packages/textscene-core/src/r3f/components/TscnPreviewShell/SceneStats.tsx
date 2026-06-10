/** Scene-count badges for the shell's top bar and dock header. */
import { useHierarchy } from '../../contexts/HierarchyContext.js';
import styles from './TscnPreviewShell.module.css';

/**
 * Compact scene stat chips for the top bar. Each chip's text is a single node
 * (e.g. "4 nodes", "2 cameras") so it never collides with the tree's node-name
 * elements that tests match via `findByText('Root')`.
 */
export function SceneStats() {
  const { sceneGraph } = useHierarchy();
  if (sceneGraph === null) return null;
  const nodeCount = sceneGraph.flattenedNodes.length;
  const cameraCount = sceneGraph.flattenedNodes.filter((n) => n.data.type === 'Camera3D').length;
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
