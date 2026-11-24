import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { subscribeToSceneTree } from '../../currentCamera.js';
import type { NodeHandle } from '../../../scene/nodeHandle.js';
import type { Scene } from '../../../scene/openScene.js';
import { ROOT_WINDOW_PATH } from '../../../scene/nodePathWalk.js';
import * as logger from '../../../logger.js';
import styles from './TscnPreviewShell.module.css';

/** The node count is authored, an instance counting once as in Godot's scene dock. */
export function SceneStats({ scene }: { scene: Scene }) {
  const counts = useSceneCounts(scene);
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
  const counts = useSceneCounts(scene);
  if (!counts) return null;
  return <span className={styles.dockCount}>{counts.nodes} nodes</span>;
}

interface SceneCounts {
  /** The scene's root node and each node it owns, as `get_owner` answers. */
  readonly nodes: number;
  readonly cameras: number;
}

/** Null before the host has sent a scene, and until the first reads land. */
function useSceneCounts(scene: Scene): SceneCounts | null {
  const observeTree = useCallback((listener: () => void) => subscribeToSceneTree(scene, listener), [scene]);
  // A write moves no owner and no class, so only a new text or a new shape reads again.
  const parse = useSyncExternalStore(scene.subscribe, scene.parse);
  const shape = useSyncExternalStore(observeTree, () =>
    treeNodes(scene)
      ?.map((node) => `${node.path}:${node.type}`)
      .join('\n')
  );
  const [counts, setCounts] = useState<SceneCounts | null>(null);
  useEffect(() => {
    let isLatest = true;
    const nodes = shape === undefined ? null : treeNodes(scene);
    const read = nodes ? countsOf(nodes) : Promise.resolve(null);
    read
      .then((next) => {
        if (isLatest) setCounts(next);
      })
      .catch((error: unknown) => {
        // A new text frees the nodes during the reads, and the counts read again over the new ones.
        if (nodes?.every((node) => node.isInsideTree()))
          logger.error(`expected the scene's nodes to count, got ${String(error)}`);
      });
    return () => {
      isLatest = false;
    };
  }, [scene, parse, shape]);
  return shape === undefined ? null : counts;
}

/** The scene's root node first, then each node below it in tree order. Undefined with no root node. */
function treeNodes(scene: Scene): NodeHandle[] | undefined {
  const root = scene.getNodeOrNull(ROOT_WINDOW_PATH)?.getChildren()[0];
  if (!root) return undefined;
  const nodes: NodeHandle[] = [];
  const visit = (node: NodeHandle): void => {
    nodes.push(node);
    for (const child of node.getChildren()) visit(child);
  };
  visit(root);
  return nodes;
}

async function countsOf([root, ...below]: readonly NodeHandle[]): Promise<SceneCounts> {
  const reads = await Promise.all(
    [root!, ...below].map(async (node) => ({
      isOwned: node === root || (await ownerPathOf(node)) === root!.path,
      isCamera: (await node.call('is_class', 'Camera3D')) === true,
    }))
  );
  return {
    nodes: reads.filter((read) => read.isOwned).length,
    cameras: reads.filter((read) => read.isCamera).length,
  };
}

/** Null for a node outside Godot's class table, such as a part of a `.glb`, which has no owner to read. */
async function ownerPathOf(node: NodeHandle): Promise<string | null> {
  if ((await node.call('is_class', 'Node')) !== true) return null;
  return ((await node.call('get_owner')) as NodeHandle | null)?.path ?? null;
}
