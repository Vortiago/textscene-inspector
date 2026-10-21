/**
 * Seats the flat `[node]` headings into the scene tree, and resolves a root-relative node path over
 * it. The parser, the linter and the language features all read this one seating. The headings'
 * nodes stay untouched: the tree holds a copy of each seated node, so a seating is repeatable.
 */

import type { NodeOrigin, NodePathResolution, RawNode, SceneNode } from './types';
import { SCENE_ROOT_PATH, joinPath, pathBetween } from '../utils/nodePath.js';
import {
  hasForeignOwner,
  isInstanceBelowRoot,
  isOutsideInstance,
  isOwnedByRoot,
  uniqueNameSetting,
  type UniqueNameClaim,
  type UniqueNameOwnership,
  type InstanceNameSetting,
} from './nodeOwner.js';
import { UNIQUE_NODE_PREFIX, walkFromRoot, type RootWalkTables } from '../godot/string/nodePath.js';
import { serialChildName } from '../godot/string/nodeName.js';
import { reparentedName } from '../godot/scene/packedScene.js';
import { idTrailEnd } from './idTrail.js';
import { refusesToInstantiate } from './instantiateRefusal.js';
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
  /** Every owner's `%Name` claims, recorded as each heading was seated, in declaration order. */
  readonly ownership: UniqueNameOwnership;
}

/** The scene tree, the copy each heading's node became in it, and the one walk over it. */
export interface SceneSeating<N extends RawNode> extends SeatedPaths<N> {
  /** The scene root with every heading Godot seats under it, or empty for a file with no node. */
  readonly roots: N[];
  /** Heading node to its copy in `roots`. A heading absent here is unreachable from the root. */
  readonly seated: ReadonlyMap<N, N>;
  /** The root-relative path of each seated copy with a name, a copy a later sibling of its name replaced included. */
  readonly pathOf: ReadonlyMap<N, string>;
}

export const MISSING = { status: 'missing' } as const;
export const UNKNOWABLE = { status: 'unknowable' } as const;

/**
 * Written only by {@link seatScene}, once per call, keyed by the roots array it returns. An entry
 * clears when nothing holds that array any more. Nothing mutates a seated tree, so an entry never
 * goes stale. It keeps the walk and the claims, not `seated`, so the heading nodes die with the parse.
 */
const seatings = new WeakMap<readonly RawNode[], SeatedPaths<RawNode>>();

export function seatScene<N extends SceneNode<N>>(origins: readonly NodeOrigin<N>[]): SceneSeating<N> {
  const seating = origins.length === 0 ? noScene<N>() : seatHeadings(origins);
  const { resolve, ownership } = seating;
  seatings.set(seating.roots, { resolve, ownership } as SeatedPaths<RawNode>);
  return seating;
}

function noScene<N extends RawNode>(): SceneSeating<N> {
  const ownership = { claims: new Map(), ownedInsideInstances: new Set<string>() };
  return { roots: [], seated: new Map(), pathOf: new Map(), resolve: () => MISSING, ownership };
}

function seatHeadings<N extends SceneNode<N>>(origins: readonly NodeOrigin<N>[]): SceneSeating<N> {
  // Heading 0 is the root when nothing is parentless: `packed_scene.cpp:218-219` makes
  // `i == 0` the root, so no later heading is a root too. Returning the flat list as
  // roots would make every node reachable and silence `orphanedNodes`.
  const rootNode = (origins.find(({ node }) => !node.parent) ?? origins[0]!).node;

  const tables = newTables(rootNode);
  const reRootsVanished = !refusesToInstantiate(origins);

  // One pass in declaration order, as Godot resolves: at heading `i`,
  // `get_node_or_null(np)` (`packed_scene.cpp:157-165`) sees only the headings above.
  // A `parent=` naming a later node vanishes and re-roots (`:208-215`). Forward order
  // also gives `children` the file's sibling order, the 2D paint order, and the
  // `%Name` claims the order instantiate sets each owner in (`:565-570`).
  const seatedByPath = new Set<N>([rootNode]);
  for (const [index, { node }] of origins.entries()) {
    if (node === rootNode) continue;
    // A second parentless node is orphaned here. `orphanedNodes` finds it by walking
    // the returned tree, so it holds no second copy of the resolution rules.
    if (!node.parent) continue;
    const end = walkFromRoot(node.parent, tables.tree);
    const parentPath = end === null || typeof end === 'string' ? end : end.unlisted;
    if (parentPath !== null && seatBelowParent(tables, node, parentPath)) {
      seatedByPath.add(node);
      continue;
    }
    // An unlisted end passed content another file lists, where Godot may still find the
    // parent, so nothing here says the path vanished and it never re-roots.
    if (end !== null && typeof end !== 'string') continue;
    // The path has vanished. A `parent_id_path=` is tried first (`:161-163`) and, where it
    // lands, seats the node somewhere this parse cannot name, so that node, like every node
    // of a refused file, stays out of the tree for `orphanedNodes`.
    if (!reRootsVanished) continue;
    if (idTrailEnd(origins, index, ({ node: heading }) => seatedByPath.has(heading))) continue;
    reRoot(tables, node);
  }

  return {
    roots: [tables.root],
    seated: tables.seated,
    pathOf: tables.pathOf,
    resolve: seatedResolver(tables),
    ownership: tables.ownership,
  };
}

/**
 * The seating {@link seatScene} built for these roots. Every tree a consumer reads comes from a
 * parse, so roots from anywhere else are a caller's error.
 */
export function sceneSeating(roots: readonly RawNode[]): SeatedPaths<RawNode> {
  const seating = seatings.get(roots);
  if (!seating) throw new Error(`expected roots that seatScene returned, got ${roots.length} other root(s)`);
  return seating;
}

/**
 * Seats one heading under the node at the path its `parent=` walks to, else below the instance
 * enclosing that path, whose sub-scene or GLB the path descends into. False where the path names
 * no node of this file. The map IS the child lookup the walk asks at every descent, so `./Mid`, `Mid/` and `Mid`
 * name the one node Godot resolves them all to while `Missing/../Mid` names none.
 */
function seatBelowParent<N extends SceneNode<N>>(
  tables: SeatingTables<N>,
  node: N,
  parentPath: string
): boolean {
  const parentNode = tables.byPath.get(parentPath);
  if (parentNode) {
    const seat = seatCopy(tables, node);
    parentNode.children.push(seat);
    register(tables, parentPath, seat, parentNode);
    return true;
  }
  // A path into instanced content names nodes in the sub-scene or GLB, so the
  // nearest enclosing instance anchors it and the content matches the rest.
  const anchor = findInstanceAnchor(parentPath, tables);
  if (!anchor) return false;
  const seat = seatCopy(tables, node);
  seat.instanceSubPath = anchor.subPath;
  anchor.node.children.push(seat);
  register(tables, anchor.foldedParentPath, seat, anchor.node);
  return true;
}

/**
 * Re-parents a node whose `parent=` vanished to the scene root and renames it
 * `<path>#<name>` (`packed_scene.cpp:208-215`, `:561-563`), numbered past a root child that
 * holds the name (`set_name`, `node.cpp:1450`, `:1593-1640`). The authored name stays on `authoredName`.
 */
function reRoot<N extends SceneNode<N>>(tables: SeatingTables<N>, node: N): void {
  const seat = seatCopy(tables, node);
  seat.authoredName = node.name;
  seat.name = serialChildName(reparentedName(node.parent!, node.name), tables.rootChildNames);
  tables.root.children.push(seat);
  register(tables, SCENE_ROOT_PATH, seat, tables.root);
}

/** The tree's own copy of a heading's node, childless, so the seating never writes to the heading. */
function seatCopy<N extends SceneNode<N>>(tables: SeatingTables<N>, node: N): N {
  const seat = { ...node, children: [] } as N;
  tables.seated.set(node, seat);
  return seat;
}

/**
 * The node a path names over the seated tables. A walk Godot ends in null is missing. One that
 * passes through content this file does not list, onto no heading, is unknowable. The walk keeps
 * only the two tables it reads, since the seating cache holds it as long as the tree lives.
 */
function seatedResolver<N extends RawNode>({
  byPath,
  tree,
}: Pick<SeatingTables<N>, 'byPath' | 'tree'>): (path: string) => NodePathResolution<N> {
  return (path) => {
    const end = walkFromRoot(path, tree);
    if (end === null) return MISSING;
    const node = typeof end === 'string' ? byPath.get(end) : undefined;
    return node ? { status: 'found', node } : UNKNOWABLE;
  };
}

/**
 * The tree so far, and the path walk's view of it. One object, since every caller
 * needs both halves, and its lookups are the ones `get_node_or_null` performs.
 */
interface SeatingTables<N> {
  /** The scene root's copy, which every re-rooted node joins. */
  readonly root: N;
  /** Written only by `seatCopy`: each heading's node to its copy. */
  readonly seated: Map<N, N>;
  /** The names of the root's children, which a re-rooted name must not repeat. */
  readonly rootChildNames: Set<string>;
  /** Every seated node, keyed by the folded path its own children address it at. */
  readonly byPath: Map<string, N>;
  /** The inverse of `byPath`, keeping a node a later sibling replaced there. */
  readonly pathOf: Map<N, string>;
  /** `%Name` to that path, for the nodes claiming one in the root's table. */
  readonly uniquePaths: Map<string, string>;
  /** Each seated node's place, both spellings from the root's own name ({@link UniqueNameClaim}). */
  readonly places: Map<N, Place>;
  /** The nearest instance below the root above each seated node that has one. */
  readonly enclosingInstances: Map<N, N>;
  /** Each instance node's `instanceNameSettings`, the array the node holds, filled in file order. */
  readonly instanceNameSettings: Map<N, InstanceNameSetting[]>;
  readonly ownership: {
    readonly claims: Map<string, UniqueNameClaim>;
    readonly ownedInsideInstances: Set<string>;
  };
  /** The same tables as the walk consumes them. */
  readonly tree: RootWalkTables;
}

/** Tables holding only the scene root's copy, which sits at the empty path. */
function newTables<N extends SceneNode<N>>(rootNode: N): SeatingTables<N> {
  const root = { ...rootNode, children: [] } as N;
  const byPath = new Map<string, N>([[SCENE_ROOT_PATH, root]]);
  // The root claims no `%Name`: `set_unique_name_in_owner` registers in the
  // node's OWNER (node.cpp:2222-2233) and the scene root has none.
  const uniquePaths = new Map<string, string>();
  const isOpaque = (path: string): boolean => isOpaqueAt(byPath, path);
  return {
    root,
    seated: new Map([[rootNode, root]]),
    rootChildNames: new Set(),
    byPath,
    pathOf: new Map([[root, SCENE_ROOT_PATH]]),
    uniquePaths,
    places: new Map([[root, { path: root.name, livePath: root.name }]]),
    enclosingInstances: new Map(),
    instanceNameSettings: new Map(),
    ownership: { claims: new Map(), ownedInsideInstances: new Set() },
    tree: { exists: (path) => canNameNode(byPath, path, isOpaque), isOpaque, uniquePaths },
  };
}

/**
 * Whether the node at a path keeps children or `%Name` claims another file lists: a missing path,
 * which passed the walk under such a node already, an override heading or instance
 * (`isTypeUnknowable`, since an override's defaulted `'Node'` is no real type), or a node another
 * owner holds.
 */
function isOpaqueAt(pathMap: ReadonlyMap<string, RawNode>, path: string): boolean {
  const node = pathMap.get(path);
  return node === undefined || isTypeUnknowable(node) || hasForeignOwner(node);
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
 * Key a seated node by the path its own children address it at, and record its `%Name` setting in
 * its owner's table. An override inside an instance keeps the sub-scene's owner, and an explicit
 * `owner=` names its own (`isOwnedByRoot`).
 */
function register<N extends RawNode>(tables: SeatingTables<N>, parentPath: string, node: N, parent: N): void {
  const place = placeBelow(tables.places.get(parent)!, node);
  tables.places.set(node, place);
  const instance = isInstanceBelowRoot(parent, parent === tables.root)
    ? parent
    : tables.enclosingInstances.get(parent);
  if (instance !== undefined) tables.enclosingInstances.set(node, instance);
  // A nameless heading claims no key: an empty name joins to its parent's own key and live path.
  // Godot seats it and places later siblings by path (`packed_scene.cpp:208-215`).
  if (!node.name) return;
  const isRootOwned = isOwnedByRoot(node, instance !== undefined);
  if (isRootOwned && instance !== undefined) tables.ownership.ownedInsideInstances.add(place.livePath);
  const path = joinPath(parentPath, node.name);
  if (parentPath === SCENE_ROOT_PATH) tables.rootChildNames.add(node.name);
  tables.byPath.set(path, node);
  tables.pathOf.set(node, path);
  const setting = uniqueNameSetting(node);
  if (setting === undefined) return;
  if (isRootOwned) {
    if (setting) claimInRoot(tables, { node, ...place }, path);
    // An inherited root owns its base's nodes (packed_scene.cpp:227-231), so only its graft over
    // the base composes the one table both files' names land in, each at its heading.
    if (tables.root.instance)
      handToInstance(tables, tables.root, {
        pathInInstance: relativeTo(tables.root.name, place.livePath)!,
        isUnique: setting,
        ownerInInstance: '',
      });
    return;
  }
  if (handToOwnerOutside(tables, node, place.livePath, setting)) return;
  const instanceLivePath = instance && tables.places.get(instance)!.livePath;
  if (instanceLivePath === undefined) return;
  const explicitOwner = node.owner === undefined ? undefined : joinPath(tables.root.name, node.owner);
  const pathInInstance = relativeTo(instanceLivePath, place.livePath)!;
  if (explicitOwner === undefined) {
    handToInstance(tables, instance!, { pathInInstance, isUnique: setting });
    return;
  }
  const ownerInInstance = relativeTo(instanceLivePath, explicitOwner);
  // Any other `owner=` outside the instance names a table this instance never reads.
  if (ownerInInstance !== undefined)
    handToInstance(tables, instance!, { pathInInstance, isUnique: setting, ownerInInstance });
}

/**
 * Hand a setting to the instance that holds the node an explicit `owner=` names, when the node sits
 * outside that instance, and say whether it did. The loader sets that owner from the root
 * (resource_format_text.cpp:257-262, packed_scene.cpp:159-161) and the name registers on it
 * (packed_scene.cpp:565-570), so the table reaches the node with `..`.
 */
function handToOwnerOutside<N extends RawNode>(
  tables: SeatingTables<N>,
  node: N,
  livePath: string,
  isUnique: boolean
): boolean {
  const owner = node.owner === undefined ? undefined : instanceHolding(tables, node.owner);
  if (!owner) return false;
  const instanceLivePath = tables.places.get(owner.instance)!.livePath;
  const pathInInstance = pathBetween(instanceLivePath, livePath);
  if (!isOutsideInstance({ pathInInstance })) return false;
  handToInstance(tables, owner.instance, { pathInInstance, isUnique, ownerInInstance: owner.pathInInstance });
  return true;
}

/**
 * The nearest seated instance at or above the node `path` names, with that node's path below it,
 * or undefined where no instance holds it. The rest of a path past its last heading lies in the
 * content of the instance that heading is in.
 */
function instanceHolding<N extends RawNode>(
  tables: SeatingTables<N>,
  path: string
): { instance: N; pathInInstance: string } | undefined {
  const names = path.split('/');
  for (let end = names.length; end > 0; end--) {
    const seated = tables.byPath.get(names.slice(0, end).join('/'));
    if (!seated) continue;
    const instance = isInstanceBelowRoot(seated, seated === tables.root)
      ? seated
      : tables.enclosingInstances.get(seated);
    if (!instance) return undefined;
    const rest = names.slice(end).join('/');
    const seatedLivePath = tables.places.get(seated)!.livePath;
    const ownerLivePath = rest ? joinPath(seatedLivePath, rest) : seatedLivePath;
    return { instance, pathInInstance: relativeTo(tables.places.get(instance)!.livePath, ownerLivePath)! };
  }
  return undefined;
}

/** Append a setting to the instance node it sits in, in file order, after the children seated so far. */
function handToInstance<N extends RawNode>(
  tables: SeatingTables<N>,
  instance: N,
  setting: Omit<InstanceNameSetting, 'hostChildrenBefore'>
): void {
  let settings = tables.instanceNameSettings.get(instance);
  if (!settings) {
    settings = [];
    tables.instanceNameSettings.set(instance, settings);
    instance.instanceNameSettings = settings;
  }
  settings.push({ ...setting, hostChildrenBefore: instance.children.length });
}

/** `path` below `base`, `''` for `base` itself, or undefined where `path` is not at or below it. */
function relativeTo(base: string, path: string): string | undefined {
  if (path === base) return '';
  return path.startsWith(base + '/') ? path.slice(base.length + 1) : undefined;
}

/** Where a node sits in the tree, and in the composed tree, both spelt from the root's own name. */
type Place = Omit<UniqueNameClaim, 'node'>;

/**
 * A child's place below its parent's. The two spellings diverge only at a node whose `parent=`
 * descends into instanced content, which alone carries `instanceSubPath`.
 */
function placeBelow(parent: Place, node: RawNode): Place {
  if (!node.name) return parent;
  const under = node.instanceSubPath ? joinPath(parent.livePath, node.instanceSubPath) : parent.livePath;
  return { path: joinPath(parent.path, node.name), livePath: joinPath(under, node.name) };
}

/**
 * Records a claim in the root's table and in the walk's view of it, unless an earlier node holds
 * the name: `_acquire_unique_name_in_owner` refuses to overwrite an entry (`node.cpp:2225-2231`).
 */
function claimInRoot<N extends RawNode>(
  tables: SeatingTables<N>,
  claim: UniqueNameClaim,
  seatPath: string
): void {
  const key = UNIQUE_NODE_PREFIX + claim.node.name;
  if (tables.uniquePaths.has(key)) return;
  tables.uniquePaths.set(key, seatPath);
  tables.ownership.claims.set(key, claim);
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
        foldedParentPath: parentPath,
      };
    }
  }
  return null;
}

/**
 * The headings whose `parent=` names nothing, derived from the seating rather than a second copy
 * of its rules: the nodes it re-rooted, and those it never seated, which are a vanished path in a
 * file or on a heading Godot does not re-root, or a non-root with no `parent=`
 * (`packed_scene.cpp:207`).
 */
export function orphanedNodes<N extends RawNode, H extends { readonly node: N }>(
  all: readonly H[],
  { seated }: Pick<SceneSeating<N>, 'seated'>
): H[] {
  // Each node arrives with its line: a lookup would need a fallback, and line 0 reads
  // as a real location in an editor gutter.
  return all.filter(({ node }) => {
    const seat = seated.get(node);
    return seat === undefined || seat.authoredName !== undefined;
  });
}
