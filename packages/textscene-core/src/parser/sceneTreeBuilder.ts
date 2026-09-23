/**
 * Builds hierarchical scene tree from flat TSCN node list.
 */

import type { NodeOrigin, TscnNode } from './types';
import {
  SCENE_ROOT_PATH,
  joinPath,
  resolveParentPath,
  type ParentPathTree,
} from '../utils/nodePath.js';
import { UNIQUE_NODE_PREFIX, isUniqueNameInOwner } from '../utils/uniqueNames.js';
import { INSTANCE_PLACEHOLDER_TYPE } from '../godot/packedScene.js';
import { isTypeUnknowable } from './typeUnknowable.js';

/**
 * The tree from the flat node list, by parent path. Paths are relative to the root:
 * "." is the root, "Foo/Bar" is root/Foo/Bar.
 */
export function buildSceneTree(nodes: TscnNode[]): TscnNode[] {
  if (nodes.length === 0) return [];

  // Heading 0 is the root when nothing is parentless: `packed_scene.cpp:218-219` makes
  // `i == 0` the root, so no later heading is a root too. Returning the flat list as
  // roots would make every node reachable and silence `strandedNodes`.
  const rootNode = nodes.find((n) => !n.parent) ?? nodes[0]!;

  const tables = newTables(rootNode);

  // One pass in declaration order, as Godot resolves: at heading `i`,
  // `get_node_or_null(np)` (`packed_scene.cpp:157-165`) sees only the headings above.
  // A `parent=` naming a later node vanishes and re-roots (`:208-215`). Forward order
  // also gives `children` the file's sibling order, the 2D paint order.
  for (const node of nodes) {
    if (node === rootNode) continue;
    // A second parentless node is stranded here. `strandedNodes` finds it by walking
    // the returned tree, so it holds no second copy of the resolution rules.
    if (!node.parent) continue;

    // The map IS the child lookup the walk asks at every descent, so `./Mid`,
    // `Mid/` and `Mid` name the one node Godot resolves them all to while
    // `Missing/../Mid` names none. A node seated through any spelling is
    // registered under the single one its own children can address it by.
    const parentPath = resolveParentPath(node.parent, tables.tree);
    if (parentPath === null) continue;

    const parentNode = tables.byPath.get(parentPath);
    if (parentNode) {
      parentNode.children.push(node);
      registerPath(tables, parentPath, node);
      continue;
    }

    // A path into instanced content names nodes in the sub-scene or GLB, so the
    // nearest enclosing instance anchors it and the content matches the rest.

    // Without an instance anchor the path is malformed. Godot re-roots such a node
    // and renames it `Level2#Name` (`:208-215`, `:561-563`). `strandedNodes` is the
    // only report of it, since a node absent from the tree is invisible to a walk.
    const anchor = findInstanceAnchor(parentPath, tables);
    if (!anchor) continue;

    anchor.node.children.push(node);
    node.instanceSubPath = anchor.subPath;
    registerPath(tables, anchor.strandedParentPath, node);
  }

  return [rootNode];
}

/**
 * The tree so far, and the path walk's view of it. One object, since every caller
 * needs both halves, and its two lookups are the two `get_node_or_null` performs.
 */
interface BuildTables {
  /** Every seated node, keyed by the folded path its own children address it at. */
  readonly byPath: Map<string, TscnNode>;
  /** `%Name` to that path, for the nodes claiming one. */
  readonly uniquePaths: Map<string, string>;
  /** The same two tables as the walk consumes them. */
  readonly tree: ParentPathTree;
}

/** Tables holding only the scene root, which sits at the empty path. */
function newTables(rootNode: TscnNode): BuildTables {
  const byPath = new Map<string, TscnNode>([[SCENE_ROOT_PATH, rootNode]]);
  // The root claims no `%Name`: `set_unique_name_in_owner` registers in the
  // node's OWNER (node.cpp:2222-2233) and the scene root has none.
  const uniquePaths = new Map<string, string>();
  return {
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
function canNameNode(pathMap: Map<string, TscnNode>, path: string): boolean {
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
function registerPath(tables: BuildTables, parentPath: string, node: TscnNode): void {
  // A nameless heading claims no key: an empty name joins to its parent's own key.
  // Godot seats it and places later siblings by path (`packed_scene.cpp:208-215`).
  if (!node.name) return;
  const path = joinPath(parentPath, node.name);
  tables.byPath.set(path, node);
  const key = UNIQUE_NODE_PREFIX + node.name;
  if (isUniqueNameInOwner(node) && !tables.uniquePaths.has(key)) tables.uniquePaths.set(key, path);
}

/** The instance a stranded node hangs off, and where that node lands. */
interface InstanceAnchor {
  /** The enclosing `instance=` node. */
  node: TscnNode;
  /** The remainder of the path below it, for the sub-scene to match. */
  subPath: string;
  /** The stranded node's own folded parent path, the key it is registered under. */
  strandedParentPath: string;
}

/**
 * The nearest instance node enclosing a resolved parent path, and the path below it,
 * or `null` for a malformed path. Longest prefix first, so nested instances anchor at
 * the innermost one: the scene that resolves the sub-path.
 */
function findInstanceAnchor(parentPath: string, tables: BuildTables): InstanceAnchor | null {
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
        strandedParentPath: parentPath,
      };
    }
  }
  return null;
}

/**
 * The nodes {@link buildSceneTree} could not place: those unreachable from `roots`,
 * derived from the tree rather than a second copy of its rules. A `parent=` naming
 * nothing, which Godot re-roots, or a non-root with no `parent=`, which
 * `packed_scene.cpp:207` refuses.
 */
export function strandedNodes(
  all: readonly NodeOrigin[],
  roots: readonly TscnNode[]
): NodeOrigin[] {
  const placed = new Set<TscnNode>();
  const walk = (nodes: readonly TscnNode[]): void => {
    for (const node of nodes) {
      if (placed.has(node)) continue;
      placed.add(node);
      walk(node.children);
    }
  };
  walk(roots);
  // Each node arrives with its line: a lookup would need a fallback, and line 0 reads
  // as a real location in an editor gutter.
  return all.filter(({ node }) => !placed.has(node));
}

/**
 * The first heading, when it declares a `parent=`: `packed_scene.cpp:219` refuses it,
 * so no scene builds. Positional, unlike {@link strandedNodes}: the engine's root is
 * `i == 0`, while `buildSceneTree` prefers a parentless heading wherever it sits.
 */
export function rootDeclaringParent(all: readonly NodeOrigin[]): NodeOrigin | undefined {
  // The declared attribute, not `node.parent`, which is unset for `parent=""`:
  // `add_node_path` indexes any value (`packed_scene.cpp:2307-2311`), so an empty one
  // still reaches the refusal.
  const first = all[0];
  return first?.declaredParent === undefined ? undefined : first;
}

/**
 * Whether the root heading states nothing Godot can build from. `:220` refuses a root
 * with none of `type=`, `instance=` and `instance_placeholder=`, and a placeholder root
 * fails at load (`resource_format_text.cpp:247-251`). It reads the heading's flag, not
 * `node.type`, which the node creators also synthesise from `instance=` and `index=`.
 */
export function rootStatesNoIdentifier(root: TscnNode | undefined): boolean {
  return root?.overridesExistingNode === true || root?.type === INSTANCE_PLACEHOLDER_TYPE;
}

/**
 * Every heading spelling `parent=""`. `prepend_period()` (resource_format_text.cpp:206-207)
 * dereferences the `data` an empty NodePath never allocates (`node_path.cpp:43-44`,
 * `:394-397`), so the load faults. Positional like {@link rootDeclaringParent}: the
 * builder may root such a heading as readily as strand it.
 */
export function emptyParentHeadings(all: readonly NodeOrigin[]): NodeOrigin[] {
  return all.filter(({ declaredParent }) => declaredParent === '');
}
