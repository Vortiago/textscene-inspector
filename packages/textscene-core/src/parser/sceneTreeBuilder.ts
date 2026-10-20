/**
 * Builds the hierarchical scene tree from the flat heading list. The headings' nodes stay
 * untouched: the tree holds a copy of each seated node, so a build is repeatable.
 */

import type { NodeOrigin, RawNode, SceneNode } from './types';
import { SCENE_ROOT_PATH, joinPath } from '../utils/nodePath.js';
import { claimUniqueName, isUniqueNameInOwner } from '../utils/uniqueNames.js';
import { resolveParentPath, type ParentPathTree } from '../godot/string/nodePath.js';
import { serialChildName } from '../godot/string/nodeName.js';
import { reparentedName } from '../godot/scene/packedScene.js';
import { idTrailEnd } from './idTrail.js';
import { refusesToInstantiate } from './instantiateRefusal.js';
import { isTypeUnknowable } from './typeUnknowable.js';

/** The built tree, and the copy each heading's node became in it. */
export interface SceneTree<N> {
  readonly roots: N[];
  /** Heading node to its copy in `roots`. A heading absent here is unreachable from the root. */
  readonly seated: ReadonlyMap<N, N>;
}

/**
 * The tree from the flat heading list, by parent path. Paths are relative to the root:
 * "." is the root, "Foo/Bar" is root/Foo/Bar.
 */
export function buildSceneTree<N extends SceneNode<N>>(origins: readonly NodeOrigin<N>[]): SceneTree<N> {
  if (origins.length === 0) return { roots: [], seated: new Map() };

  // Heading 0 is the root when nothing is parentless: `packed_scene.cpp:218-219` makes
  // `i == 0` the root, so no later heading is a root too. Returning the flat list as
  // roots would make every node reachable and silence `orphanedNodes`.
  const rootNode = (origins.find(({ node }) => !node.parent) ?? origins[0]!).node;

  const tables = newTables(rootNode);
  const { seated } = tables;
  const reRootsVanished = !refusesToInstantiate(origins);

  // One pass in declaration order, as Godot resolves: at heading `i`,
  // `get_node_or_null(np)` (`packed_scene.cpp:157-165`) sees only the headings above.
  // A `parent=` naming a later node vanishes and re-roots (`:208-215`). Forward order
  // also gives `children` the file's sibling order, the 2D paint order.
  const seatedByPath = new Set<N>([rootNode]);
  for (const [index, { node }] of origins.entries()) {
    if (node === rootNode) continue;
    // A second parentless node is orphaned here. `orphanedNodes` finds it by walking
    // the returned tree, so it holds no second copy of the resolution rules.
    if (!node.parent) continue;

    // The map IS the child lookup the walk asks at every descent, so `./Mid`,
    // `Mid/` and `Mid` name the one node Godot resolves them all to while
    // `Missing/../Mid` names none. A node seated through any spelling is
    // registered under the single one its own children can address it by.
    const parentPath = resolveParentPath(node.parent, tables.tree);
    if (parentPath !== null && seatBelowParent(tables, parentPath, node)) {
      seatedByPath.add(node);
      continue;
    }

    // The path has vanished. A `parent_id_path=` is tried first (`:161-163`) and, where it
    // lands, seats the node somewhere this parse cannot name, so that node, like every node
    // of a refused file, stays out of the tree for `orphanedNodes`.
    if (!reRootsVanished) continue;
    if (idTrailEnd(origins, index, ({ node: heading }) => seatedByPath.has(heading))) continue;
    reRoot(tables, node);
  }

  return { roots: [tables.root], seated };
}

/**
 * Seats `node` below the node at `parentPath`, else below the instance enclosing it, whose
 * sub-scene or GLB the path descends into. False where the path names no node of this file.
 */
function seatBelowParent<N extends SceneNode<N>>(
  tables: BuildTables<N>,
  parentPath: string,
  node: N
): boolean {
  const parentNode = tables.byPath.get(parentPath);
  if (parentNode) {
    const seat = seatCopy(tables, node);
    parentNode.children.push(seat);
    registerPath(tables, parentPath, seat);
    return true;
  }
  // A path into instanced content names nodes in the sub-scene or GLB, so the
  // nearest enclosing instance anchors it and the content matches the rest.
  const anchor = findInstanceAnchor(parentPath, tables);
  if (!anchor) return false;
  const seat = seatCopy(tables, node);
  seat.instanceSubPath = anchor.subPath;
  anchor.node.children.push(seat);
  registerPath(tables, anchor.foldedParentPath, seat);
  return true;
}

/**
 * Re-parents a node whose `parent=` vanished to the scene root and renames it
 * `<path>#<name>` (`packed_scene.cpp:208-215`, `:561-563`), numbered past a root child that
 * holds the name (`set_name`, `node.cpp:1450`, `:1593-1640`). The authored name stays on `authoredName`.
 */
function reRoot<N extends SceneNode<N>>(tables: BuildTables<N>, node: N): void {
  const seat = seatCopy(tables, node);
  seat.authoredName = node.name;
  seat.name = serialChildName(reparentedName(node.parent!, node.name), tables.rootChildNames);
  tables.root.children.push(seat);
  registerPath(tables, SCENE_ROOT_PATH, seat);
}

/** The tree's own copy of a heading's node, childless, so the build never writes to the heading. */
function seatCopy<N extends SceneNode<N>>(tables: BuildTables<N>, node: N): N {
  const seat = { ...node, children: [] } as N;
  tables.seated.set(node, seat);
  return seat;
}

/**
 * The tree so far, and the path walk's view of it. One object, since every caller
 * needs both halves, and its two lookups are the two `get_node_or_null` performs.
 */
interface BuildTables<N> {
  /** The scene root's copy, which every re-rooted node joins. */
  readonly root: N;
  /** Written only by `seatCopy`: each heading's node to its copy. */
  readonly seated: Map<N, N>;
  /** The names of the root's children, which a re-rooted name must not repeat. */
  readonly rootChildNames: Set<string>;
  /** Every seated node, keyed by the folded path its own children address it at. */
  readonly byPath: Map<string, N>;
  /** `%Name` to that path, for the nodes claiming one. */
  readonly uniquePaths: Map<string, string>;
  /** The same two tables as the walk consumes them. */
  readonly tree: ParentPathTree;
}

/** Tables holding only the scene root, which sits at the empty path. */
function newTables<N extends SceneNode<N>>(rootNode: N): BuildTables<N> {
  const seated = new Map<N, N>();
  const root = { ...rootNode, children: [] } as N;
  seated.set(rootNode, root);
  const byPath = new Map<string, N>([[SCENE_ROOT_PATH, root]]);
  // The root claims no `%Name`: `set_unique_name_in_owner` registers in the
  // node's OWNER (node.cpp:2222-2233) and the scene root has none.
  const uniquePaths = new Map<string, string>();
  return {
    root,
    seated,
    rootChildNames: new Set<string>(),
    byPath,
    uniquePaths,
    tree: { exists: (path) => canNameNode(byPath, path), uniquePaths },
  };
}

/**
 * Whether a name the walk descended onto could be a node: the child lookup at
 * `node.cpp:1941-1946`, answered by a parse blind to instanced scenes. Only a name
 * below a parent this file describes is one Godot fails to find. A parent missing from
 * the map passed one segment ago, so instanced content vouched for it.
 */
function canNameNode(pathMap: ReadonlyMap<string, RawNode>, path: string): boolean {
  if (pathMap.has(path)) return true;
  const cut = path.lastIndexOf('/');
  const parent = pathMap.get(cut === -1 ? SCENE_ROOT_PATH : path.slice(0, cut));
  // `isTypeUnknowable`, not an `instance=` test: an override heading, which Godot
  // writes for editable children, names a node the base scene declares, so its
  // children live there too. Its defaulted `'Node'` is not a real type.
  return parent === undefined || isTypeUnknowable(parent);
}

/**
 * Key a seated node by the path its own children address it at, and by the `%Name` it
 * claims. First claim wins: a second claimant warns and clears its own flag
 * (`node.cpp:2225-2231`).
 */
function registerPath<N extends RawNode>(tables: BuildTables<N>, parentPath: string, node: N): void {
  // A nameless heading claims no key: an empty name joins to its parent's own key.
  // Godot seats it and places later siblings by path (`packed_scene.cpp:208-215`).
  if (!node.name) return;
  const path = joinPath(parentPath, node.name);
  if (parentPath === SCENE_ROOT_PATH) tables.rootChildNames.add(node.name);
  tables.byPath.set(path, node);
  if (isUniqueNameInOwner(node)) claimUniqueName(tables.uniquePaths, node.name, path);
}

/** The instance an orphaned node hangs off, and where that node lands. */
interface InstanceAnchor<N> {
  /** The enclosing `instance=` node. */
  node: N;
  /** The remainder of the path below it, for the sub-scene to match. */
  subPath: string;
  /** The orphaned node's own folded parent path, the key it is registered under. */
  foldedParentPath: string;
}

/**
 * The nearest instance node enclosing a resolved parent path, and the path below it,
 * or `null` for a malformed path. Longest prefix first, so nested instances anchor at
 * the innermost one: the scene that resolves the sub-path.
 */
function findInstanceAnchor<N extends RawNode>(
  parentPath: string,
  tables: BuildTables<N>
): InstanceAnchor<N> | null {
  // The root is seated from the start, so a node naming it never reaches here.
  if (!parentPath) return null;

  const segments = parentPath.split('/');
  // Start one short of the full path: had the whole thing resolved, ordinary
  // placement would already have used it.
  for (let depth = segments.length - 1; depth >= 0; depth--) {
    const candidate = tables.byPath.get(segments.slice(0, depth).join('/'));
    if (candidate?.instance) {
      return {
        node: candidate,
        subPath: segments.slice(depth).join('/'),
        foldedParentPath: parentPath,
      };
    }
  }
  return null;
}

/**
 * The headings whose `parent=` names nothing, derived from the tree rather than a second copy of
 * its rules: the nodes the builder re-rooted, and those it never seated, which are a vanished
 * path in a file or on a heading Godot does not re-root, or a non-root with no `parent=`
 * (`packed_scene.cpp:207`).
 */
export function orphanedNodes<N extends RawNode>(
  all: readonly NodeOrigin<N>[],
  { seated }: Pick<SceneTree<N>, 'seated'>
): NodeOrigin<N>[] {
  // Each node arrives with its line: a lookup would need a fallback, and line 0 reads
  // as a real location in an editor gutter.
  return all.filter(({ node }) => {
    const seat = seated.get(node);
    return seat === undefined || seat.authoredName !== undefined;
  });
}
