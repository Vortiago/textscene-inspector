import type { NodeHandle } from '../../../scene/nodeHandle.js';
import type { Scene } from '../../../scene/openScene.js';
import { useSceneRead } from './sceneRead.js';
import styles from './TscnPreviewShell.module.css';

/** The node count is authored, an instance counting once as in Godot's scene dock. */
export function SceneStats({ scene }: { scene: Scene }) {
  const counts = useSceneRead(scene, countsOf);
  if (!counts) return null;
  const { nodes, cameras } = counts;
  return (
    <div className={styles.statChips} role="group" aria-label="Scene info">
      <span className={styles.statChip} data-testid="scene-info-nodes">{`${nodes} nodes`}</span>
      {cameras > 0 && (
        <span className={styles.statChip}>{`${cameras} ${cameras === 1 ? 'camera' : 'cameras'}`}</span>
      )}
    </div>
  );
}

/** Node-count badge for the Scene Tree dock header. */
export function SceneNodeCount({ scene }: { scene: Scene }) {
  const counts = useSceneRead(scene, countsOf);
  if (!counts) return null;
  return <span className={styles.dockCount}>{counts.nodes} nodes</span>;
}

interface SceneCounts {
  /** The scene's root node and each node it owns, as `get_owner` answers. */
  readonly nodes: number;
  readonly cameras: number;
}

async function countsOf(root: NodeHandle): Promise<SceneCounts> {
  const below = descendantsOf(root);
  const [ownedBelow, cameras] = await Promise.all([
    Promise.all(
      below.map(async (node) => ((await node.call('get_owner')) as NodeHandle | null)?.path === root.path)
    ),
    Promise.all([root, ...below].map(async (node) => (await node.call('is_class', 'Camera3D')) === true)),
  ]);
  return { nodes: 1 + ownedBelow.filter(Boolean).length, cameras: cameras.filter(Boolean).length };
}

/** Each node below `node`, in tree order. */
function descendantsOf(node: NodeHandle): NodeHandle[] {
  return node.getChildren().flatMap((child) => [child, ...descendantsOf(child)]);
}
