/**
 * Seats the flat `[node]` headings into the scene tree, and resolves a root-relative node path over
 * it. The parser, the linter and the language features all read this one seating.
 */

import type { NodePathResolution, RawNode, SceneNode } from './types';
import { SCENE_ROOT_PATH, joinPath } from '../utils/nodePath.js';
import { claimUniqueName, isInstanceBelowRoot, isOwnedByRoot, isUniqueNameInOwner } from './nodeOwner.js';
import { UNLISTED, walkFromRoot, type RootWalkTables } from '../godot/string/nodePath.js';
import { isTypeUnknowable } from './typeUnknowable.js';

/**
 * The one walk over a seated scene. Paths are relative to the root: "." is the root, "Foo/Bar" is
 * root/Foo/Bar.
 */
export interface SeatedPaths<N extends RawNode> {
  /**
   * The node a root-relative path names once every heading is seated: how instantiate resolves a
   * `[connection]` `from=` and `to=` (`packed_scene.cpp:161`, `:656-657`), and a `%Name` the root
   * owns.
   */
  resolve(path: string): NodePathResolution<N>;
}

/** The scene tree, and the one walk over it. */
export interface SceneSeating<N extends RawNode> extends SeatedPaths<N> {
  /** The scene root with every heading Godot seats under it, or empty for a file with no node. */
  readonly roots: N[];
}

export const MISSING = { status: 'missing' } as const;
export const UNKNOWABLE = { status: 'unknowable' } as const;

const NO_SCENE: SeatedPaths<RawNode> = { resolve: () => MISSING };

/**
 * Written by {@link seatScene} for the roots it returns, and by {@link sceneSeating} for a tree it
 * seats. A parsed tree is never mutated in place, so an entry never goes stale, and it dies with
 * its tree.
 */
const seatings = new WeakMap<readonly RawNode[], SeatedPaths<RawNode>>();

export function seatScene<N extends SceneNode<N>>(nodes: N[]): SceneSeating<N> {
  if (nodes.length === 0) return { roots: [], resolve: () => MISSING };

  // Heading 0 is the root when nothing is parentless: `packed_scene.cpp:218-219` makes
  // `i == 0` the root, so no later heading is a root too. Returning the flat list as
  // roots would make every node reachable and silence `strandedNodes`.
  const rootNode = nodes.find((n) => !n.parent) ?? nodes[0]!;

  const tables = newTables(rootNode);

  // One pass in declaration order, as Godot resolves: at heading `i`,
  // `get_node_or_null(np)` (`packed_scene.cpp:157-165`) sees only the headings above.
  // A `parent=` naming a later node vanishes and re-roots (`:208-215`). Forward order
  // also gives `children` the file's sibling order, the 2D paint order, and the
  // `%Name` claims the order instantiate sets each owner in (`:565-570`).
  for (const node of nodes) {
    if (node === rootNode) continue;
    // A second parentless node is stranded here. `strandedNodes` finds it by walking
    // the returned tree, so it holds no second copy of the resolution rules.
    if (!node.parent) continue;
    seat(tables, node, node.parent);
  }

  const seating: SceneSeating<N> = { roots: [rootNode], resolve: (path) => resolveSeated(tables, path) };
  seatings.set(seating.roots, seating as SeatedPaths<RawNode>);
  return seating;
}

/**
 * The seating of a tree: the one {@link seatScene} built for these roots, or else the tree seated
 * as it stands, in tree order. A hand-built tree and a composed render tree come from no heading
 * list, so tree order is the only order they have.
 */
export function sceneSeating(roots: readonly RawNode[]): SeatedPaths<RawNode> {
  let seating = seatings.get(roots);
  if (!seating) {
    seating = seatTree(roots);
    seatings.set(roots, seating);
  }
  return seating;
}

/** Registers a built tree's nodes under the paths their places in it spell. */
function seatTree(roots: readonly RawNode[]): SeatedPaths<RawNode> {
  const root = roots[0];
  if (!root) return NO_SCENE;
  const tables = newTables(root);
  const visit = (parent: RawNode, parentPath: string): void => {
    for (const child of parent.children) {
      // A node seated through an instance anchor keeps the path its `parent=` spelled.
      const childParentPath = child.instanceSubPath
        ? joinPath(parentPath, child.instanceSubPath)
        : parentPath;
      register(tables, childParentPath, child, parent);
      visit(child, child.name ? joinPath(childParentPath, child.name) : childParentPath);
    }
  };
  visit(root, SCENE_ROOT_PATH);
  return { resolve: (path) => resolveSeated(tables, path) };
}

/**
 * Seats one heading under the node its `parent=` names, or leaves it stranded. The map IS the
 * child lookup the walk asks at every descent, so `./Mid`, `Mid/` and `Mid` name the one node
 * Godot resolves them all to while `Missing/../Mid` names none. A node seated through any spelling
 * is registered under the single one its own children can address it by.
 */
function seat<N extends SceneNode<N>>(tables: SeatingTables<N>, node: N, parent: string): void {
  const parentPath = walkFromRoot(parent, tables.tree);
  if (parentPath === null || parentPath === UNLISTED) return;

  const parentNode = tables.byPath.get(parentPath);
  if (parentNode) {
    parentNode.children.push(node);
    register(tables, parentPath, node, parentNode);
    return;
  }

  // A path into instanced content names nodes in the sub-scene or GLB, so the
  // nearest enclosing instance anchors it and the content matches the rest.
  const anchor = findInstanceAnchor(parentPath, tables);
  // Without an instance anchor the path is malformed. Godot re-roots such a node
  // and renames it `Level2#Name` (`:208-215`, `:561-563`). `strandedNodes` is the
  // only report of it, since a node absent from the tree is invisible to a walk.
  if (!anchor) return;

  anchor.node.children.push(node);
  node.instanceSubPath = anchor.subPath;
  register(tables, anchor.strandedParentPath, node, anchor.node);
}

/**
 * The node a path names over the seated tables. A walk Godot ends in null is missing. One that
 * passes through content this file does not list, onto no heading, is unknowable.
 */
function resolveSeated<N extends RawNode>(tables: SeatingTables<N>, path: string): NodePathResolution<N> {
  const end = walkFromRoot(path, tables.tree);
  if (end === null) return MISSING;
  const node = end === UNLISTED ? undefined : tables.byPath.get(end);
  return node ? { status: 'found', node } : UNKNOWABLE;
}

/**
 * The tree so far, and the path walk's view of it. One object, since every caller
 * needs both halves, and its lookups are the ones `get_node_or_null` performs.
 */
interface SeatingTables<N> {
  /** Every seated node, keyed by the folded path its own children address it at. */
  readonly byPath: Map<string, N>;
  /** `%Name` to that path, for the nodes claiming one in the root's table. */
  readonly uniquePaths: Map<string, string>;
  /** The seated nodes with an `instance=` ancestor below the root. */
  readonly insideInstance: Set<N>;
  /** The same tables as the walk consumes them. */
  readonly tree: RootWalkTables;
}

/** Tables holding only the scene root, which sits at the empty path. */
function newTables<N extends RawNode>(rootNode: N): SeatingTables<N> {
  const byPath = new Map<string, N>([[SCENE_ROOT_PATH, rootNode]]);
  // The root claims no `%Name`: `set_unique_name_in_owner` registers in the
  // node's OWNER (node.cpp:2222-2233) and the scene root has none.
  const uniquePaths = new Map<string, string>();
  const isOpaque = (path: string): boolean => isOpaqueAt(byPath, path);
  return {
    byPath,
    uniquePaths,
    insideInstance: new Set(),
    tree: { exists: (path) => canNameNode(byPath, path, isOpaque), isOpaque, uniquePaths },
  };
}

/**
 * Whether the node at a path keeps children or `%Name` claims another file lists. A path missing
 * from the map passed the walk under such a node already. `isTypeUnknowable`, not an `instance=`
 * test: an override heading, which Godot writes for editable children, names a node the base scene
 * declares, so its children live there too. Its defaulted `'Node'` is not a real type.
 */
function isOpaqueAt(pathMap: ReadonlyMap<string, RawNode>, path: string): boolean {
  const node = pathMap.get(path);
  return node === undefined || isTypeUnknowable(node);
}

/**
 * Whether a name the walk descended onto could be a node: the child lookup at
 * `node.cpp:1941-1946`, answered by a parse blind to instanced scenes. Only a name
 * below a parent this file describes is one Godot fails to find.
 */
function canNameNode(
  pathMap: ReadonlyMap<string, RawNode>,
  path: string,
  isOpaque: (path: string) => boolean
): boolean {
  if (pathMap.has(path)) return true;
  const cut = path.lastIndexOf('/');
  return isOpaque(cut === -1 ? SCENE_ROOT_PATH : path.slice(0, cut));
}

/**
 * Key a seated node by the path its own children address it at, and by the `%Name` it
 * claims in the root's table. First claim wins: a second claimant warns and clears its own
 * flag (`node.cpp:2225-2231`).
 */
function register<N extends RawNode>(tables: SeatingTables<N>, parentPath: string, node: N, parent: N): void {
  const isRoot = parent === tables.byPath.get(SCENE_ROOT_PATH);
  const insideInstance = tables.insideInstance.has(parent) || isInstanceBelowRoot(parent, isRoot);
  if (insideInstance) tables.insideInstance.add(node);
  // A nameless heading claims no key: an empty name joins to its parent's own key.
  // Godot seats it and places later siblings by path (`packed_scene.cpp:208-215`).
  if (!node.name) return;
  const path = joinPath(parentPath, node.name);
  tables.byPath.set(path, node);
  if (isUniqueNameInOwner(node) && isOwnedByRoot(node, insideInstance)) {
    claimUniqueName(tables.uniquePaths, node.name, path);
  }
}

/** The instance a stranded node hangs off, and where that node lands. */
interface InstanceAnchor<N> {
  /** The enclosing `instance=` node. */
  node: N;
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
function findInstanceAnchor<N extends RawNode>(
  parentPath: string,
  tables: SeatingTables<N>
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
        strandedParentPath: parentPath,
      };
    }
  }
  return null;
}

/**
 * The nodes {@link seatScene} could not place: those unreachable from `roots`,
 * derived from the tree rather than a second copy of its rules. A `parent=` naming
 * nothing, which Godot re-roots, or a non-root with no `parent=`, which
 * `packed_scene.cpp:207` refuses.
 */
export function strandedNodes<H extends { readonly node: RawNode }>(
  all: readonly H[],
  roots: readonly RawNode[]
): H[] {
  const placed = new Set<RawNode>();
  const walk = (nodes: readonly RawNode[]): void => {
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
