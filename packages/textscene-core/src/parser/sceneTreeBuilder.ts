/**
 * Seats the flat `[node]` headings into the scene tree, and resolves a root-relative node path over
 * it. The parser, the linter and the language features all read this one seating. The headings'
 * nodes stay untouched: the tree holds a copy of each seated node, so a seating is repeatable.
 */

import type { NodeOrigin, NodePathResolution, OwnerRecovery, RawNode, SceneNode } from './types';
import {
  SCENE_ROOT_PATH,
  joinPath,
  parentPathOf,
  pathBetween,
  relativeTo,
  spelledNodePath,
} from '../utils/nodePath.js';
import {
  hasForeignOwner,
  isInstanceBelowRoot,
  isOwnedByRoot,
  NO_OWNER,
  uniqueNameSetting,
  type HeadingsInsideInstance,
  type UniqueNameClaim,
  type UniqueNameOwnership,
  type InstanceNameSetting,
  type InstanceOwnerFallback,
  type OwnerHandOff,
} from './nodeOwner.js';
import {
  UNIQUE_NODE_PREFIX,
  nodePathWalkNames,
  simplifiedNames,
  walkFromRoot,
  walkedPath,
  type RootWalkTables,
} from '../godot/string/nodePath.js';
import { reparentedName, reRootedName, type TrailHeading } from '../godot/scene/packedScene.js';
import { contentTrailSegment, idTrailEnd, ownerTrailEnd, trailHeadingsOf } from './idTrail.js';
import { refusesToInstantiate } from './instantiateRefusal.js';
import { isTypeUnknowable } from './typeUnknowable.js';
import { insertAtIndex } from '../godot/scene/siblingIndex.js';

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
  /** What an id trail that enters this scene reads of each heading, in file order. */
  readonly headings: readonly TrailHeading[];
}

/**
 * A heading whose `owner=` walk enters an instance, and whose `owner_uid_path=` names the root.
 * The root claims its `%Name` only where that walk finds no node (packed_scene.cpp:159-163), which
 * only a reader that sees the instance can tell: it re-seats the scene where the walk finds one.
 */
export interface RootFallback {
  readonly heading: RawNode;
  /** The hand-off the instance's graft reports where its walk finds no node. */
  readonly handOff: OwnerHandOff;
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

/** What {@link seatScene} keeps of a seating: the walk, the claims and the trail headings, not `seated`. */
interface SeatingEntry extends SeatedPaths<RawNode> {
  /** The `%Name` claims of the root that wait on an instance's owner walk, in file order. */
  readonly rootFallbacks: readonly RootFallback[];
  /** The headings to seat again from, kept only where a {@link RootFallback} may need it. */
  readonly origins?: readonly NodeOrigin<RawNode>[];
}

/**
 * Written only by {@link seatScene}, once per call, keyed by the roots array it returns. An entry
 * clears when nothing holds that array any more, and never goes stale, as nothing mutates a seated
 * tree. Only a scene with a root fallback keeps its heading nodes.
 */
// eslint-disable-next-line no-restricted-syntax -- seatScene writes each entry from outside, and sceneSeating only reads it back
const seatings = new WeakMap<readonly RawNode[], SeatingEntry>();

/**
 * Seats `origins`. The root claims the `%Name` of each {@link RootFallback} whose heading is not in
 * `ownersFound`, the headings whose `owner=` walk a reader that sees the instance found a node for.
 * Without `ownersFound`, which only such a reader passes, a walk through such a claim is unknowable.
 */
export function seatScene<N extends SceneNode<N>>(
  origins: readonly NodeOrigin<N>[],
  ownersFound?: ReadonlySet<RawNode>
): SceneSeating<N> {
  const { rootFallbacks, ...seating } =
    origins.length === 0 ? noScene<N>() : seatHeadings(origins, ownersFound);
  const { resolve, ownership, headings } = seating;
  seatings.set(seating.roots, {
    resolve,
    ownership,
    headings,
    rootFallbacks,
    ...(rootFallbacks.length > 0 ? { origins: origins as readonly NodeOrigin<RawNode>[] } : {}),
  });
  return seating;
}

/**
 * The roots of the scene these roots were seated from, seated again with `ownersFound`
 * ({@link seatScene}). Only roots with a {@link RootFallback} can be.
 */
export function reseatedRoots<N extends SceneNode<N>>(
  roots: readonly N[],
  ownersFound: ReadonlySet<RawNode>
): readonly N[] {
  const { origins } = seatings.get(roots) ?? {};
  if (!origins) throw new Error(`expected roots with a root fallback, got ${roots.length} other root(s)`);
  return seatScene(origins as readonly NodeOrigin<N>[], ownersFound).roots;
}

/** A seating with the root fallbacks {@link seatScene} keeps beside it. */
type SeatingWithFallbacks<N extends RawNode> = SceneSeating<N> & {
  readonly rootFallbacks: readonly RootFallback[];
};

function noScene<N extends RawNode>(): SeatingWithFallbacks<N> {
  return {
    roots: [],
    seated: new Map(),
    pathOf: new Map(),
    resolve: () => MISSING,
    ownership: emptyOwnership(),
    headings: [],
    rootFallbacks: [],
  };
}

function seatHeadings<N extends SceneNode<N>>(
  origins: readonly NodeOrigin<N>[],
  ownersFound: ReadonlySet<RawNode> | undefined
): SeatingWithFallbacks<N> {
  // Heading 0 is the root when nothing is parentless: `packed_scene.cpp:218-219` makes
  // `i == 0` the root, so no later heading is a root too. Returning the flat list as
  // roots would make every node reachable and silence `orphanedNodes`.
  const rootNode = (origins.find(({ node }) => !node.parent) ?? origins[0]!).node;

  const tables = newTables(rootNode, ownersFound);
  const reRootsVanished = !refusesToInstantiate(origins);

  // One pass in declaration order, as Godot resolves: at heading `i`,
  // `get_node_or_null(np)` (`packed_scene.cpp:157-165`) sees only the headings above.
  // A `parent=` naming a later node vanishes and re-roots (`:208-215`). Forward order
  // also gives `children` the file's sibling order, the 2D paint order, and the
  // `%Name` claims the order instantiate sets each owner in (`:565-570`).
  const seatedByPath = new Set<N>([rootNode]);
  const isPlaced = ({ node: heading }: NodeOrigin<N>) => seatedByPath.has(heading);
  for (const [index, { node }] of origins.entries()) {
    if (node === rootNode) continue;
    // A second parentless node is orphaned here. `orphanedNodes` finds it absent from
    // `seated`, so it holds no second copy of the resolution rules.
    if (!node.parent) continue;
    // Only a heading that gets a seat resolves its `owner=`.
    const resolveOwner: OwnerResolver = () =>
      node.owner === undefined ? undefined : seatedOwner(tables, origins, index, isPlaced);
    rememberUndecidedSeat(tables, node.parent, node.name);
    const end = walkFromRoot(node.parent, tables.tree);
    const parentPath = walkedPath(end);
    if (parentPath !== null && seatBelowParent(tables, node, parentPath, resolveOwner)) {
      seatedByPath.add(node);
      rememberTrailFallback(tables, origins, index, isPlaced);
      continue;
    }
    // An unlisted end passed content another file lists, where Godot may still find the
    // parent, so nothing here says the path vanished and it never re-roots.
    if (end !== null && typeof end !== 'string') continue;
    // The path has vanished. A `parent_id_path=` is tried first (`:161-163`). Where it lands in
    // this file, the node sits under that heading. Where it enters an instance, the node sits
    // somewhere this parse cannot name, so the instance's graft places it.
    if (!reRootsVanished) continue;
    const recovered = idTrailEnd(origins, index, isPlaced);
    if (recovered === undefined) reRoot(tables, node, resolveOwner);
    else if (recovered.kind === 'lands')
      seatLanded(tables, node, origins[recovered.heading]!.node, resolveOwner);
    else seatInContent(tables, node, origins[recovered.heading]!.node, recovered.rest, resolveOwner);
  }

  return {
    roots: [tables.root],
    seated: tables.seated,
    pathOf: dropContentSeatPaths(tables),
    resolve: seatedResolver(tables),
    ownership: tables.ownership,
    headings: trailHeadingsOf(origins),
    rootFallbacks: tables.rootFallbacks,
  };
}

/** One shared array, so a lookup keyed on the headings' identity builds once for every unseated scene. */
const NO_HEADINGS: readonly TrailHeading[] = [];

/**
 * The trail headings of the scene {@link seatScene} built these roots from, or none for roots that
 * came from elsewhere, such as a GLB's synthesised scene, which has no headings to follow.
 */
export function sceneHeadings(roots: readonly RawNode[]): readonly TrailHeading[] {
  return seatings.get(roots)?.headings ?? NO_HEADINGS;
}

/** The root fallbacks of the scene {@link seatScene} built these roots from, or none for roots that came from elsewhere. */
export function sceneRootFallbacks(roots: readonly RawNode[]): readonly RootFallback[] {
  return seatings.get(roots)?.rootFallbacks ?? [];
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
  parentPath: string,
  resolveOwner: OwnerResolver
): boolean {
  const parentNode = tables.byPath.get(parentPath);
  if (parentNode) {
    const seat = seatCopy(tables, node, resolveOwner);
    // An instance's own nodes are not in this list, so an `index=` below one is no place in it.
    if (parentNode.instance) parentNode.children.push(seat);
    else insertAtIndex(parentNode.children, seat);
    register(tables, parentPath, seat, parentNode);
    return true;
  }
  // A path into instanced content names nodes in the sub-scene or GLB, so the
  // nearest enclosing instance anchors it and the content matches the rest.
  const anchor = findInstanceAnchor(parentPath, tables);
  if (!anchor) return false;
  const seat = seatCopy(tables, node, resolveOwner);
  seat.instanceSubPath = anchor.subPath;
  anchor.node.children.push(seat);
  register(tables, anchor.foldedParentPath, seat, anchor.node);
  return true;
}

/**
 * Seats a heading under the heading its `parent_id_path=` landed on, at the path that heading's
 * node has in the tree (`packed_scene.cpp:161-163`, `:1985-2005`). A heading with no name has no
 * path to continue from, and this parse leaves the node out.
 */
function seatLanded<N extends SceneNode<N>>(
  tables: SeatingTables<N>,
  node: N,
  landedOn: N,
  resolveOwner: OwnerResolver
): void {
  const parentPath = tables.pathOf.get(tables.seated.get(landedOn)!);
  if (parentPath === undefined || !seatBelowParent(tables, node, parentPath, resolveOwner)) return;
  tables.seated.get(node)!.landedByIdTrail = true;
}

/**
 * Keeps on the seat of a heading below an instance's content where its `parent_id_path=` would seat
 * it, should the content lack the path its `parent=` names (`packed_scene.cpp:161-163`). Only the
 * live tree can tell, so the seat holds both.
 */
function rememberTrailFallback<N extends SceneNode<N>>(
  tables: SeatingTables<N>,
  origins: readonly NodeOrigin<N>[],
  index: number,
  isPlaced: (origin: NodeOrigin<N>) => boolean
): void {
  if (origins[index]!.idTrail === undefined) return;
  const seat = tables.seated.get(origins[index]!.node)!;
  if (seat.instanceSubPath === undefined) return;
  const end = idTrailEnd(origins, index, isPlaced);
  if (end === undefined) return;
  const target = tables.seated.get(origins[end.heading]!.node);
  const path = target && fileSeatPath(tables, target);
  if (path === undefined) return;
  seat.parentTrailFallback = end.kind === 'lands' ? { path } : { path, contentTrail: end.rest };
}

/**
 * Seats a heading below the instance heading its `parent_id_path=` enters, with the rest of the
 * trail for that instance's graft (`packed_scene.cpp:1985-2005`). The node it finds lies in the
 * instance's content, so its key holds a segment no heading writes (`registerInContent`). A heading with no seat leaves the node out.
 */
function seatInContent<N extends SceneNode<N>>(
  tables: SeatingTables<N>,
  node: N,
  instance: N,
  rest: readonly number[],
  resolveOwner: OwnerResolver
): void {
  const instanceSeat = tables.seated.get(instance);
  if (!instanceSeat) return;
  const seat = seatCopy(tables, node, resolveOwner);
  seat.landedByIdTrail = true;
  seat.parentContentTrail = rest;
  instanceSeat.children.push(seat);
  registerInContent(tables, instanceSeat, seat, rest);
}

/** Keys `node` at `path` for the headings that name it and the children that hang below it. */
function keyAt<N extends RawNode>(tables: SeatingTables<N>, path: string, node: N): void {
  tables.byPath.set(path, node);
  tables.pathOf.set(node, path);
}

/**
 * Keys a node seated below an instance for a trail, so a later heading names it by its `%Name`
 * (`node.cpp:1930-1938`, `packed_scene.cpp:565-570`) and its children follow it to the graft's
 * placement. Its path in the tree is the graft's to find, so the key holds a segment no heading
 * writes: `:` ends a name in a NodePath. A claim another owner holds is the graft's to land too.
 */
function registerInContent<N extends SceneNode<N>>(
  tables: SeatingTables<N>,
  instanceSeat: N,
  seat: N,
  rest: readonly number[]
): void {
  tables.contentSeats.add(seat);
  if (!seat.name) return;
  const segment = contentTrailSegment(rest);
  const { path: authored, livePath } = tables.places.get(instanceSeat)!;
  const place = placeBelow(
    { path: joinPath(authored, segment), livePath: joinPath(livePath, segment) },
    seat
  );
  tables.places.set(seat, place);
  const path = joinPath(joinPath(tables.pathOf.get(instanceSeat)!, segment), seat.name);
  keyAt(tables, path, seat);
  recordSetting(tables, { node: seat, ...place }, path, isOwnedByRoot(seat, true));
}

/**
 * The path `seat` holds in this file, or undefined for a node seated for a trail: only the graft knows
 * its path in the tree, so no root-relative path an owner or a trail names reaches it.
 */
function fileSeatPath<N extends RawNode>(tables: SeatingTables<N>, seat: N): string | undefined {
  return tables.contentSeats.has(seat) ? undefined : tables.pathOf.get(seat);
}

/** Removes from `pathOf` the nodes whose path only the graft knows, and returns it. Called once, when the seating is done. */
function dropContentSeatPaths<N extends RawNode>({ pathOf, contentSeats }: SeatingTables<N>): Map<N, string> {
  for (const seat of contentSeats) pathOf.delete(seat);
  return pathOf;
}

/**
 * Re-parents a node whose `parent=` vanished to the scene root and renames it
 * `<path>#<name>` (`packed_scene.cpp:208-215`, `:561-563`), numbered past a root child that
 * holds the name (`set_name`, `node.cpp:1450`, `:1593-1640`). The authored name stays on `authoredName`.
 */
function reRoot<N extends SceneNode<N>>(
  tables: SeatingTables<N>,
  node: N,
  resolveOwner: OwnerResolver
): void {
  const seat = seatCopy(tables, node, resolveOwner);
  seat.authoredName = node.name;
  seat.name = reRootedName(node.parent!, node.name, tables.rootChildNames);
  insertAtIndex(tables.root.children, seat);
  register(tables, SCENE_ROOT_PATH, seat, tables.root);
}

/**
 * The tree's own copy of a heading's node, childless and with its `owner=` as `seatedOwner` resolved
 * it, so the seating never writes to the heading.
 */
function seatCopy<N extends SceneNode<N>>(tables: SeatingTables<N>, node: N, resolveOwner: OwnerResolver): N {
  const owner = resolveOwner();
  const seat = { ...node, children: [], ...owner } as N;
  tables.seated.set(node, seat);
  return seat;
}

/**
 * Where a heading below a `%Name` that a live reader decides sits: under this file's claimant, and
 * re-rooted, as either may hold it. That claim is a root fallback's, or this file's at an inherited
 * root, whose base may claim the name first (node.cpp:2222-2233).
 */
function rememberUndecidedSeat<N extends RawNode>(
  tables: SeatingTables<N>,
  parent: string,
  name: string
): void {
  const names = nodePathWalkNames(parent);
  const isInheritedRoot = tables.root.instance !== undefined;
  const at = names.findIndex(
    (part) => tables.awaitedKeys.has(part) || (isInheritedRoot && tables.uniquePaths.has(part))
  );
  if (at === -1) return;
  const claimant = tables.uniquePaths.get(names[at]!)!;
  const claimedParent = walkedPath(walkFromRoot([claimant, ...names.slice(at + 1)].join('/'), tables.tree));
  if (claimedParent !== null) tables.undecidedSeats.add(joinPath(claimedParent, name));
  tables.undecidedSeats.add(reparentedName(parent, name));
}

/**
 * The node a path names over the seated tables. A walk Godot ends in null is missing. One that
 * passes through content this file does not list, onto no heading, through a `%Name` a root
 * fallback awaits, or at or below an undecided seat, is unknowable. The walk keeps only the tables
 * it reads, since the seating cache holds it as long as the tree lives.
 */
function seatedResolver<N extends RawNode>({
  byPath,
  tree,
  awaitedKeys,
  undecidedSeats,
}: Pick<SeatingTables<N>, 'byPath' | 'tree' | 'awaitedKeys' | 'undecidedSeats'>): (
  path: string
) => NodePathResolution<N> {
  return (path) => {
    // The walk's names, not a split on `/`: a `:subname` stays off the last name (node_path.cpp:405-427).
    const names = nodePathWalkNames(path);
    if (names.some((name) => awaitedKeys.has(name))) return UNKNOWABLE;
    if (undecidedSeats.size > 0 && isAtOrBelowAny(simplifiedNames(names), undecidedSeats)) return UNKNOWABLE;
    const end = walkFromRoot(path, tree);
    if (end === null) return MISSING;
    const node = typeof end === 'string' ? byPath.get(end) : undefined;
    return node ? { status: 'found', node } : UNKNOWABLE;
  };
}

/** Whether the path `names` spells is one of `paths`, or below one. */
function isAtOrBelowAny(names: readonly string[], paths: ReadonlySet<string>): boolean {
  return names.some((_, index) => paths.has(names.slice(0, index + 1).join('/')));
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
  /** The headings whose `owner=` walk a reader that sees the instance found a node for, or undefined in a parse. */
  readonly ownersFound: ReadonlySet<RawNode> | undefined;
  /** Written only by `claimOnFallback`, in file order. */
  readonly rootFallbacks: RootFallback[];
  /** The root's `%Name` keys a {@link RootFallback} claims, which a parse cannot answer. */
  readonly awaitedKeys: Set<string>;
  /** Written only by `rememberUndecidedSeat`: the paths a heading may hold, which a parse cannot answer. */
  readonly undecidedSeats: Set<string>;
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
  /** The nodes seated for a trail that enters an instance, and every node below one. */
  readonly contentSeats: Set<N>;
  readonly ownership: {
    readonly claims: Map<string, UniqueNameClaim>;
    readonly insideInstances: Map<string, HeadingsInsideInstance>;
  };
  /** The same tables as the walk consumes them. */
  readonly tree: RootWalkTables;
}

/** Tables holding only the scene root's copy, which sits at the empty path. */
function newTables<N extends SceneNode<N>>(
  rootNode: N,
  ownersFound: ReadonlySet<RawNode> | undefined
): SeatingTables<N> {
  const root = { ...rootNode, children: [] } as N;
  const byPath = new Map<string, N>([[SCENE_ROOT_PATH, root]]);
  // The root claims no `%Name`: `set_unique_name_in_owner` registers in the
  // node's OWNER (node.cpp:2222-2233) and the scene root has none.
  const uniquePaths = new Map<string, string>();
  const isOpaque = (path: string): boolean => isOpaqueAt(byPath, path);
  return {
    root,
    seated: new Map([[rootNode, root]]),
    ownersFound,
    rootFallbacks: [],
    awaitedKeys: new Set(),
    undecidedSeats: new Set(),
    rootChildNames: new Set(),
    byPath,
    pathOf: new Map([[root, SCENE_ROOT_PATH]]),
    uniquePaths,
    places: new Map([[root, { path: root.name, livePath: root.name }]]),
    enclosingInstances: new Map(),
    instanceNameSettings: new Map(),
    contentSeats: new Set(),
    ownership: emptyOwnership(),
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
  return isOpaque(parentPathOf(path) ?? SCENE_ROOT_PATH);
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
  const isBelowContent = tables.contentSeats.has(parent);
  if (isBelowContent) tables.contentSeats.add(node);
  // Content sits in an instance, so an override heading below a trail seat keeps the sub-scene's owner.
  const isRootOwned = isOwnedByRoot(node, instance !== undefined || isBelowContent);
  if (instance !== undefined) recordInsideInstance(tables, place.livePath, node, isRootOwned);
  const path = joinPath(parentPath, node.name);
  if (parentPath === SCENE_ROOT_PATH) tables.rootChildNames.add(node.name);
  keyAt(tables, path, node);
  recordSetting(tables, { node, ...place }, path, isRootOwned, isBelowContent ? undefined : instance);
}

/**
 * Record the `%Name` setting of a seated node in its owner's table: the root's where `isRootOwned`,
 * else the one its explicit `owner=` names, else the one of `instance`, the instance it sits in.
 * An inherited root owns its base's nodes (packed_scene.cpp:227-231), so only its graft over the
 * base composes the one table both files' names land in, each at its heading.
 */
function recordSetting<N extends RawNode>(
  tables: SeatingTables<N>,
  claim: UniqueNameClaim & { readonly node: N },
  path: string,
  isRootOwned: boolean,
  instance?: N
): void {
  const setting = uniqueNameSetting(claim.node);
  if (setting === undefined) return;
  if (isRootOwned) {
    if (setting) claimInRoot(tables, claim, path);
    if (tables.root.instance)
      handToInstance(tables, tables.root, {
        pathInInstance: relativeTo(tables.root.name, claim.livePath)!,
        isUnique: setting,
        ownerInInstance: '',
      });
    return;
  }
  if (claim.node.owner !== undefined) {
    handToOwner(tables, claim, path, setting);
    return;
  }
  if (instance === undefined) return;
  handToInstance(tables, instance, {
    pathInInstance: pathInInstance(tables, instance, claim.livePath)!,
    isUnique: setting,
  });
}

/**
 * The fields of a seated copy that hold its owner: a root-relative path, and where an
 * `owner_uid_path=` enters the instance at that path, the ids still to follow inside it.
 */
type SeatedOwner = Pick<RawNode, 'owner' | 'ownerContentTrail' | 'ownerTrailFallback'>;

/** Resolves a heading's owner once the heading gets a seat, since only a seated heading has one. */
type OwnerResolver = () => SeatedOwner | undefined;

const NO_SEATED_OWNER: SeatedOwner = { owner: NO_OWNER };

/**
 * The `owner=` of `origins[index]` as the path of the node it names, walked from the root over the
 * headings seated so far, as instantiate walks it when it sets the owner (packed_scene.cpp:159-168,
 * :565-568): `.` for the root, and a `%Name` replaced by its claimant. A walk into content this file
 * does not list keeps the rest for that instance to resolve. A walk that finds nothing falls back to
 * the `owner_uid_path=`, and where that finds nothing the node has no owner.
 */
function seatedOwner<N extends SceneNode<N>>(
  tables: SeatingTables<N>,
  origins: readonly NodeOrigin<N>[],
  index: number,
  isPlaced: (origin: NodeOrigin<N>) => boolean
): SeatedOwner {
  const walked = walkedPath(walkFromRoot(origins[index]!.node.owner, tables.tree));
  if (walked === null) return recoveredOwner(tables, origins, index, isPlaced) ?? NO_SEATED_OWNER;
  const owner = spelledNodePath(walked);
  // A path no heading holds lies in an instance's content, where the walk may still find nothing.
  const fallback = tables.byPath.has(walked) ? undefined : recoveredOwner(tables, origins, index, isPlaced);
  return fallback ? { owner, ownerTrailFallback: fallback } : { owner };
}

/**
 * The owner the `owner_uid_path=` of `origins[index]` finds: the heading it lands on, or the instance
 * heading it enters with the rest of the trail. Undefined where it finds nothing this parse can name.
 */
function recoveredOwner<N extends SceneNode<N>>(
  tables: SeatingTables<N>,
  origins: readonly NodeOrigin<N>[],
  index: number,
  isPlaced: (origin: NodeOrigin<N>) => boolean
): OwnerRecovery | undefined {
  const recovered = ownerTrailEnd(origins, index, isPlaced);
  if (recovered === undefined) return undefined;
  const seat = tables.seated.get(origins[recovered.heading]!.node);
  const path = seat && fileSeatPath(tables, seat);
  if (path === undefined) return undefined;
  const owner = spelledNodePath(path);
  return recovered.kind === 'lands' ? { owner } : { owner, ownerContentTrail: recovered.rest };
}

/**
 * Hand a setting to the instance that holds the node an explicit `owner=` names. The loader sets
 * that owner (resource_format_text.cpp:257-262) and the name registers on it (packed_scene.cpp:565-570),
 * so a node outside that instance is spelt with `..`. An owner no instance holds names a table no
 * instance reads.
 */
function handToOwner<N extends RawNode>(
  tables: SeatingTables<N>,
  claim: UniqueNameClaim & { readonly node: N },
  seatPath: string,
  isUnique: boolean
): void {
  const { owner: ownerPath, ownerContentTrail, ownerTrailFallback } = claim.node;
  if (ownerPath === undefined || ownerPath === NO_OWNER) return;
  const owner = instanceHolding(tables, rootRelative(ownerPath));
  if (!owner) return;
  const pathIn = (instance: N): string => pathBetween(tables.places.get(instance)!.livePath, claim.livePath);
  const setting = {
    pathInInstance: pathIn(owner.instance),
    isUnique,
    ...asOwnerFallback(owner.pathInInstance, { ownerContentTrail }),
  };
  if (!ownerTrailFallback) {
    handToInstance(tables, owner.instance, setting);
    return;
  }
  if (isPlainRoot(tables, ownerTrailFallback)) {
    claimOnFallback(tables, owner.instance, setting, claim, seatPath);
    return;
  }
  const fallback = instanceHolding(tables, rootRelative(ownerTrailFallback.owner));
  if (!fallback) {
    handToInstance(tables, owner.instance, setting);
    return;
  }
  const ownerFallback = asOwnerFallback(fallback.pathInInstance, ownerTrailFallback);
  if (fallback.instance === owner.instance) {
    handToInstance(tables, owner.instance, { ...setting, ownerFallback });
    return;
  }
  // Only the graft of the walked owner's instance knows whether the walk finds a node.
  const handOff: OwnerHandOff = Symbol(claim.livePath);
  handToInstance(tables, owner.instance, { ...setting, ownerHandOff: handOff });
  handToInstance(tables, fallback.instance, {
    pathInInstance: pathIn(fallback.instance),
    isUnique,
    ...ownerFallback,
    awaits: handOff,
  });
}

/** Whether an `owner_uid_path=` owner is the root of a file that inherits no base, whose table is this seating's. */
function isPlainRoot<N extends RawNode>(
  tables: SeatingTables<N>,
  { owner, ownerContentTrail }: OwnerRecovery
): boolean {
  return rootRelative(owner) === SCENE_ROOT_PATH && ownerContentTrail === undefined && !tables.root.instance;
}

/**
 * Hand a setting to the instance its `owner=` walk enters, and claim its name in the root, which
 * its `owner_uid_path=` names, where the walk finds no node there ({@link RootFallback}). A seating
 * that knows the walk finds one hands the setting only.
 */
function claimOnFallback<N extends RawNode>(
  tables: SeatingTables<N>,
  instance: N,
  setting: Omit<InstanceNameSetting, 'hostChildrenBefore'>,
  claim: UniqueNameClaim & { readonly node: N },
  seatPath: string
): void {
  const heading = headingOf(tables, claim.node);
  if (tables.ownersFound?.has(heading)) {
    handToInstance(tables, instance, setting);
    return;
  }
  const handOff: OwnerHandOff = Symbol(claim.livePath);
  handToInstance(tables, instance, { ...setting, ownerHandOff: handOff });
  tables.rootFallbacks.push({ heading, handOff });
  if (!setting.isUnique) return;
  const key = UNIQUE_NODE_PREFIX + claim.node.name;
  claimInRoot(tables, claim, seatPath);
  if (!tables.ownersFound && tables.uniquePaths.get(key) === seatPath) tables.awaitedKeys.add(key);
}

/** The heading whose node `seat` is a copy of. A scan, as only a rare root fallback asks. */
function headingOf<N extends RawNode>({ seated }: SeatingTables<N>, seat: N): N {
  for (const [heading, copy] of seated) if (copy === seat) return heading;
  throw new Error(`expected a seated copy, got "${seat.name}"`);
}

/** The owner an `owner_uid_path=` finds, as the instance at whose path it sits reads it. */
function asOwnerFallback(
  ownerInInstance: string,
  { ownerContentTrail }: Pick<OwnerRecovery, 'ownerContentTrail'>
): InstanceOwnerFallback {
  return { ownerInInstance, ...(ownerContentTrail === undefined ? {} : { ownerContentTrail }) };
}

/** The root-relative spelling of an owner path: `.` is the root. */
function rootRelative(ownerPath: string): string {
  return ownerPath === '.' ? SCENE_ROOT_PATH : ownerPath;
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
  for (let end = names.length; end >= 0; end--) {
    const seated = tables.byPath.get(names.slice(0, end).join('/'));
    if (!seated) continue;
    const instance = isInstanceAt(tables, seated) ? seated : tables.enclosingInstances.get(seated);
    if (!instance) return undefined;
    const rest = names.slice(end).join('/');
    const seatedLivePath = tables.places.get(seated)!.livePath;
    const ownerLivePath = rest ? joinPath(seatedLivePath, rest) : seatedLivePath;
    return { instance, pathInInstance: pathInInstance(tables, instance, ownerLivePath)! };
  }
  return undefined;
}

/**
 * Whether a seated node is an instance whose graft composes a table: one below the root, or an
 * inherited root, which owns its base's nodes (packed_scene.cpp:227-231).
 */
function isInstanceAt<N extends RawNode>(tables: SeatingTables<N>, node: N): boolean {
  return node === tables.root ? Boolean(node.instance) : isInstanceBelowRoot(node, false);
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

/** The live path `livePath` below the seated `instance`, or undefined where it is not at or below it. */
function pathInInstance<N extends RawNode>(
  tables: SeatingTables<N>,
  instance: N,
  livePath: string
): string | undefined {
  return relativeTo(tables.places.get(instance)!.livePath, livePath);
}

/** Fold a heading inside an instance into what the file's earlier headings at its live path say. */
function recordInsideInstance<N extends RawNode>(
  tables: SeatingTables<N>,
  livePath: string,
  node: N,
  isRootOwned: boolean
): void {
  const earlier = tables.ownership.insideInstances.get(livePath);
  tables.ownership.insideInstances.set(livePath, {
    isRootOwned: isRootOwned || earlier?.isRootOwned === true,
    isAdded: !node.overridesExistingNode || earlier?.isAdded === true,
  });
}

/** The ownership record of a file that has seated nothing yet. */
function emptyOwnership(): SeatingTables<RawNode>['ownership'] {
  return { claims: new Map(), insideInstances: new Map() };
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

/** The instance a node whose path descends into instanced content hangs off, and where it lands. */
interface InstanceAnchor<N> {
  /** The enclosing `instance=` node. */
  node: N;
  /** The remainder of the path below it, for the sub-scene to match. */
  subPath: string;
  /** The node's own folded parent path, the key it is registered under. */
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
  seating: Pick<SceneSeating<N>, 'seated'>
): H[] {
  // Each node arrives with its line: a lookup would need a fallback, and line 0 reads
  // as a real location in an editor gutter.
  const isSeated = isSeatedAtOwnPathIn(seating);
  return all.filter((heading) => !isSeated(heading));
}

/**
 * Whether a heading's node sits at the path its `parent=` names in `seating`. A re-rooted copy keeps
 * its `authoredName`, a landed one lives under the heading its trail named, and a node the seating
 * left out has no copy.
 */
export function isSeatedAtOwnPathIn<N extends RawNode>({
  seated,
}: Pick<SceneSeating<N>, 'seated'>): (heading: { readonly node: N }) => boolean {
  return ({ node }) => {
    const seat = seated.get(node);
    return seat !== undefined && !isReRooted(seat) && seat.landedByIdTrail === undefined;
  };
}

/** Whether the tree node is a copy the builder re-rooted, which keeps the name its heading wrote. */
export function isReRooted(seat: RawNode): boolean {
  return seat.authoredName !== undefined;
}

/**
 * The seated node each seated copy sits under because its `parent=` names it, or its
 * `parent_id_path=` landed it there. A re-rooted copy has none, since its path vanished, and a copy
 * seated below an instance for a path into that instance has none, since no heading of this file is
 * the node the path names.
 */
export function seatedParents<N extends SceneNode<N>>(roots: readonly N[]): Map<N, N> {
  const parents = new Map<N, N>();
  const pending = [...roots];
  for (let parent = pending.pop(); parent; parent = pending.pop()) {
    for (const child of parent.children) {
      if (!isReRooted(child) && child.instanceSubPath === undefined && child.parentContentTrail === undefined)
        parents.set(child, parent);
      pending.push(child);
    }
  }
  return parents;
}
