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
 * Build scene tree from flat node list using parent path references.
 * Parent paths in TSCN are relative to root: "." = root, "Foo/Bar" = root/Foo/Bar
 */
export function buildSceneTree(nodes: TscnNode[]): TscnNode[] {
  if (nodes.length === 0) return [];

  // Heading 0 is the root when nothing declares itself parentless: `packed_scene.cpp:218-219`
  // makes `i == 0` the root and fails the instantiate outright when it names a
  // parent, so there is no reading under which the later headings are roots too.
  // Handing the flat list back as roots made every node reachable, which is the
  // set `strandedNodes` derives its answer from — the report went silent on
  // exactly the file the engine refuses.
  const rootNode = nodes.find((n) => !n.parent) ?? nodes[0]!;

  const tables = newTables(rootNode);

  // ONE pass, in declaration order, because that is the order Godot resolves
  // in: `NODE_FROM_ID` asks `ret_nodes[0]->get_node_or_null(np)`
  // (`packed_scene.cpp:157-165`), and at heading `i` that tree holds only the
  // headings above it. Repeating until a pass places nothing resolved against
  // the FINISHED tree instead, so a `parent=` naming a node declared later
  // seated silently where Godot warns the path vanished and re-roots
  // (`:208-215`) — the node got the wrong parent, the wrong inherited
  // transform and the wrong 2D paint order, and nothing said so.
  //
  // Forward order is also what gives `children` the `.tscn`'s own sibling
  // order, which is the 2D paint order: earlier siblings draw behind.
  for (const node of nodes) {
    if (node === rootNode) continue;
    // A second parentless node cannot be placed by path, so it is stranded
    // here — `strandedNodes` finds it by walking the tree this returns, which
    // is why that derivation is not a second copy of the resolution rules.
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

    // A node whose parent path descends INTO instanced content can never
    // resolve against a declared node: the intermediate names live in the
    // instanced scene or GLB, not in this file. Godot only lets you address
    // into a sub-scene you INSTANCED, so the nearest enclosing instance node
    // is the anchor, and the rest of the path is that content's business to
    // match.
    //
    // Requiring the anchor to be instance-bearing is what separates these from
    // genuinely malformed paths: a scene that says `parent="Level2"` when the
    // root has no such child is a mistake, and re-rooting it under the nearest
    // resolvable ancestor would hide it. Godot re-roots such a node to the
    // SCENE root and renames it `Level2#Name` (`:208-215`, `:561-563`);
    // `strandedNodes` below is what carries the same fact to a caller, since a
    // node absent from the tree is otherwise invisible to everything walking
    // it, and it is the ONLY report.
    const anchor = findInstanceAnchor(parentPath, tables);
    if (!anchor) continue;

    anchor.node.children.push(node);
    node.instanceSubPath = anchor.subPath;
    registerPath(tables, anchor.strandedParentPath, node);
  }

  return [rootNode];
}

/**
 * What the build knows about the tree so far, and the view of it the path walk
 * asks — one object because every consulting site needs both halves and the
 * two lookups it exposes are the two `get_node_or_null` performs.
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
 * Whether a name the walk just descended onto could be a node — the child
 * lookup `get_node_or_null` does at `node.cpp:1941-1946`, answered by a parse
 * that cannot see inside an instanced scene.
 *
 * A path this map holds is a node. One it does not is a node too whenever its
 * own parent is not in the map either, or is a heading that does not say what
 * its node is: the walk asked about that parent one segment ago and it passed,
 * so a parent the map has since stopped holding is one instanced content
 * vouched for. Only a name below a parent this file DOES describe is a name
 * Godot fails to find.
 *
 * `isTypeUnknowable`, not an `instance=` test: an override heading names a node
 * the base scene declares, so ITS children live there too. Godot writes exactly
 * that shape for editable children — `[node name="Inside" parent="Building"
 * index="0"]` between the instance and the path — and reading the heading's
 * defaulted `'Node'` as a real type strands every heading below it.
 */
function canNameNode(pathMap: Map<string, TscnNode>, path: string): boolean {
  if (pathMap.has(path)) return true;
  const cut = path.lastIndexOf('/');
  const parent = pathMap.get(cut === -1 ? SCENE_ROOT_PATH : path.slice(0, cut));
  return parent === undefined || isTypeUnknowable(parent);
}

/**
 * Key a seated node by the path its own children address it at, and by the
 * `%Name` it claims.
 *
 * A heading with no `name=` identifies no node, so it claims no key: joining an
 * empty name onto its parent's path yields that parent's OWN key, and the
 * nameless node would take the place of the node the file does name. Godot
 * seats it and leaves every later sibling where its `parent=` says
 * (`packed_scene.cpp:208-215` places by path, never by the previous heading).
 *
 * First claim wins: a second node claiming a name already in the owner's table
 * warns and clears its OWN flag rather than displacing the holder
 * (`node.cpp:2225-2231`).
 */
function registerPath(tables: BuildTables, parentPath: string, node: TscnNode): void {
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
  /** The stranded node's OWN folded parent path — the key it is registered under. */
  strandedParentPath: string;
}

/**
 * The nearest INSTANCE node enclosing an already-resolved parent path, and the
 * remainder of that path below it — or `null` when the path names no instanced
 * content, which makes it a malformed path rather than an override.
 *
 * Prefixes are walked longest-first so nested instances anchor at the innermost
 * one: the sub-path has to be measured from the scene that will actually
 * resolve it.
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
 * The entries {@link buildSceneTree} could not place, out of every node the
 * scan produced.
 *
 * Derived from the tree it actually returned rather than re-deciding
 * resolvability: the placement above seats a path descending into instanced
 * content at its anchor, and a second copy of that judgement would drift from
 * this one. A node reachable from `roots` was placed; every other node was
 * not.
 *
 * Two shapes end up here. One declares a `parent=` path that names nothing —
 * Godot warns and re-roots it. One declares no `parent=` at all while not being
 * the root, which `packed_scene.cpp:207` refuses outright.
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
  // Every node arrives with its line already attached rather than being looked
  // up here: a lookup needs a fallback, and there is no honest one — a
  // diagnostic pointing at line 0 reads as a real location in an editor gutter.
  return all.filter(({ node }) => !placed.has(node));
}

/**
 * The FIRST heading, when it declares a `parent=`.
 *
 * `packed_scene.cpp:219` refuses exactly that — "root node %s cannot specify a
 * parent node" — so the file loads and no scene can be built from it.
 *
 * Positional, unlike {@link strandedNodes}, and deliberately not "the heading
 * that became our root": the engine's root is `i == 0` and nothing else, while
 * `buildSceneTree` above prefers a parentless heading wherever it sits. Given
 * `[node name="A" parent="."]` followed by a parentless `Root`, the two answer
 * differently — the builder roots at `Root` and seats `A` beneath it, and only
 * the positional reading still names the heading Godot refuses.
 *
 * The test is the DECLARED attribute, not `node.parent`: both parsers leave the
 * latter unset for `parent=""`, and `add_node_path` returns an index for any
 * value the field carries (`packed_scene.cpp:2307-2311`), so an empty one still
 * reaches the refusal.
 */
export function rootDeclaringParent(all: readonly NodeOrigin[]): NodeOrigin | undefined {
  const first = all[0];
  return first?.declaredParent === undefined ? undefined : first;
}

/**
 * Whether the root heading states nothing Godot can build a node from.
 *
 * `:220` refuses an instantiate whose root is `TYPE_INSTANTIATED` with no base
 * scene — a heading carrying none of `type=`, `instance=` and
 * `instance_placeholder=` — and a placeholder root refuses earlier still, at the
 * load (`resource_format_text.cpp:247-251`).
 *
 * Beside the two derivations below because it answers the same kind of question
 * about the same heading, and because the flag it reads is the HEADING's own
 * attributes: `node.type` is not, since both node creators synthesise it from
 * `instance=` and `index=` as well.
 */
export function rootStatesNoIdentifier(root: TscnNode | undefined): boolean {
  return root?.overridesExistingNode === true || root?.type === INSTANCE_PLACEHOLDER_TYPE;
}

/**
 * Every heading spelling `parent=""`, which the text loader cannot read.
 *
 * `resource_format_text.cpp:206-207` builds the NodePath and calls
 * `prepend_period()` on it while reading ANY heading, and that method
 * dereferences the `data` an empty NodePath never allocates
 * (`node_path.cpp:43-44`, `:394-397`) — so the load faults there and no node in
 * the file is built.
 *
 * Positional like {@link rootDeclaringParent} rather than derived from the tree:
 * both parsers leave `node.parent` unset for an empty one, so such a heading is
 * placed as a root by the builder above as readily as it is stranded, and only
 * the declared attribute names every one of them.
 */
export function emptyParentHeadings(all: readonly NodeOrigin[]): NodeOrigin[] {
  return all.filter(({ declaredParent }) => declaredParent === '');
}
