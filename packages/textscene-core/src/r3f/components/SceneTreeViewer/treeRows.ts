import type { NodeHandle } from '../../../scene/nodeHandle.js';
import { isNodeHandle } from '../../../scene/nodeMethods.js';
import { livePathOf } from '../../../scene/nodePathWalk.js';

/** The classes that have the eye (scene_tree_editor.cpp:608). */
export type VisibilityChain = 'Node3D' | 'CanvasItem' | 'CanvasLayer' | 'Window';

/** One row of the Scene dock, as the node handles answer it. */
export interface TreeRow {
  readonly node: NodeHandle;
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

/** The dock's rows from the scene's root node. */
export function treeRowsOf(root: NodeHandle): Promise<TreeRow> {
  return rowOf({ root, editableOwners: new Map() }, root);
}

/** Every row below and including `row`, in the dock's pre-order. */
export function rowsOf(row: TreeRow | null): TreeRow[] {
  return row ? [row, ...row.children.flatMap(rowsOf)] : [];
}

/** One walk: the scene root, and `is_editable_instance` of each owner it asked, as siblings share one. */
interface RowWalk {
  readonly root: NodeHandle;
  readonly editableOwners: Map<NodeHandle, Promise<boolean>>;
}

async function rowOf(walk: RowWalk, node: NodeHandle): Promise<TreeRow> {
  const [chain, isViewport, sceneFilePath, children] = await Promise.all([
    chainOf(node),
    node.call('is_class', 'Viewport'),
    node === walk.root ? '' : node.get('scene_file_path'),
    listedChildrenOf(walk, node),
  ]);
  return {
    node,
    path: livePathOf(node.path),
    name: node.name,
    type: node.type,
    chain,
    isViewport: isViewport === true,
    sceneFilePath: typeof sceneFilePath === 'string' ? sceneFilePath : '',
    children: await Promise.all(children.map((child) => rowOf(walk, child))),
  };
}

async function chainOf(node: NodeHandle): Promise<VisibilityChain | null> {
  const answers = await Promise.all(CHAINS.map((chain) => node.call('is_class', chain)));
  return CHAINS[answers.indexOf(true)] ?? null;
}

async function listedChildrenOf(walk: RowWalk, node: NodeHandle): Promise<readonly NodeHandle[]> {
  const children = node.getChildren();
  const listed = await Promise.all(children.map((child) => isListed(walk, child)));
  return children.filter((_, index) => listed[index]);
}

// scene_tree_editor.cpp:283-290: an owned node of the scene, or a node of an editable instance.
async function isListed(walk: RowWalk, node: NodeHandle): Promise<boolean> {
  const owner = await node.call('get_owner');
  if (owner === walk.root) return true;
  if (!isNodeHandle(owner)) return false;
  let editable = walk.editableOwners.get(owner);
  if (!editable) {
    editable = walk.root.call('is_editable_instance', owner).then((answer) => answer === true);
    walk.editableOwners.set(owner, editable);
  }
  return editable;
}
