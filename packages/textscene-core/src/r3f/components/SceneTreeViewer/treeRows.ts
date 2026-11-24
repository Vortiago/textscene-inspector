import type { NodeHandle } from '../../../scene/nodeHandle.js';
import type { Scene } from '../../../scene/openScene.js';
import { livePathOf, ROOT_WINDOW_PATH } from '../../../scene/nodePathWalk.js';

/** The classes that have the eye (scene_tree_editor.cpp:608). */
export type VisibilityChain = 'Node3D' | 'CanvasItem' | 'CanvasLayer' | 'Window';

/** One row of the Scene dock, as the node handles answer it. */
export interface TreeRow {
  /** The live path the selection names: `Main/Player`. */
  readonly path: string;
  readonly name: string;
  readonly type: string;
  readonly chain: VisibilityChain | null;
  readonly isViewport: boolean;
  /** The scene an instance below the root opens, else empty: Godot's "Open in Editor" row. */
  readonly sceneFilePath: string;
  readonly children: readonly TreeRow[];
}

const CHAINS: readonly VisibilityChain[] = ['Node3D', 'CanvasItem', 'CanvasLayer', 'Window'];

/** The dock's rows from the scene root, null before the host has sent a scene. */
export async function treeRowsOf(scene: Scene): Promise<TreeRow | null> {
  const root = scene.getNodeOrNull(ROOT_WINDOW_PATH)?.getChildren()[0];
  return root ? rowOf(root, root) : null;
}

async function rowOf(root: NodeHandle, node: NodeHandle): Promise<TreeRow> {
  const [chain, isViewport, sceneFilePath, children] = await Promise.all([
    chainOf(node),
    node.call('is_class', 'Viewport'),
    node === root ? '' : node.get('scene_file_path'),
    listedChildrenOf(root, node),
  ]);
  return {
    path: livePathOf(node.path),
    name: node.name,
    type: node.type,
    chain,
    isViewport: isViewport === true,
    sceneFilePath: typeof sceneFilePath === 'string' ? sceneFilePath : '',
    children: await Promise.all(children.map((child) => rowOf(root, child))),
  };
}

async function chainOf(node: NodeHandle): Promise<VisibilityChain | null> {
  const answers = await Promise.all(CHAINS.map((chain) => node.call('is_class', chain)));
  return CHAINS[answers.indexOf(true)] ?? null;
}

async function listedChildrenOf(root: NodeHandle, node: NodeHandle): Promise<readonly NodeHandle[]> {
  const children = node.getChildren();
  const listed = await Promise.all(children.map((child) => isListed(root, child)));
  return children.filter((_, index) => listed[index]);
}

// scene_tree_editor.cpp:283-290: an owned node of the scene, or a node of an editable instance.
async function isListed(root: NodeHandle, node: NodeHandle): Promise<boolean> {
  const owner = await node.call('get_owner');
  if (owner === root) return true;
  if (!owner || typeof owner !== 'object' || !('getChildren' in owner)) return false;
  return (await root.call('is_editable_instance', owner)) === true;
}
