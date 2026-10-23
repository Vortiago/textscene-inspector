/**
 * The owner whose `%Name` table a rendered node resolves against, that table at composed live
 * paths, and the local scene a local-to-scene resource on the node measures from. Each instance
 * root has a table of its own, which an outer consumer never sees (`uniqueNameOwner.md`). The
 * collapse composes an instance's table, and this reads it. Pure: it walks the composed live tree
 * over a cache snapshot, like `liveSceneTree.ts`, and the React hooks supply reactivity.
 */

import type { SceneScope, TscnNode } from '../parser/types.js';
import { NO_OWNER, type HeadingsInsideInstance } from '../parser/nodeOwner.js';
import { liveInstancePath, type LiveNode } from '../resources/liveNode.js';
import { belowRoot, joinPath, pathBetween, pathUnder } from '../utils/nodePath.js';
import { UNIQUE_NODE_PREFIX, nodePathWalkNames, simplifiedNodePath } from '../godot/string/nodePath.js';
import {
  cachedUniqueNameLivePaths,
  cachedUniqueNameOwnership,
  cachedUniqueNamesBelowRoot,
} from '../utils/uniqueNames.js';
import { perTree } from '../utils/perTree.js';
import { perObject } from '../utils/perObject.js';
import type { UniqueNamePaths, UniqueNameTable } from '../resources/instanceNameTable.js';
import {
  LiveTree,
  liveTreeOf,
  mergedNodeOf,
  rootGroups,
  snapshotScenes,
  type LiveChildGroup,
  type LiveTreeContext,
} from './liveSceneTree.js';

interface ClaimOwner {
  /** Live path of the node this owner's root renders at. */
  readonly path: string;
  /** The authored roots of the file this owner is the root of. */
  readonly roots: readonly TscnNode[];
  /** The owner of the instance node itself: the file its heading is in. Absent for the outer root. */
  readonly parent?: ClaimOwner;
  /** The live tree the walk that found this owner reads, which its table's paths are placed over. */
  readonly live: PlacedLiveTree;
  /** The table the collapse composed, on an instance that collapses into its sub-scene root, or none for no owner. */
  readonly composed?: UniqueNameTable;
}

/** A composed live path spelled the way `owner`'s own file spells it. */
function fileLocalPath(owner: ClaimOwner, livePath: string): string {
  if (!owner.parent) return livePath;
  return pathUnder(owner.roots[0]!.name, pathBetween(owner.path, livePath));
}

/** The inverse: a live path from `owner`'s file, composed under its render path. */
function composedPath(owner: ClaimOwner, fileLivePath: string): string {
  if (!owner.parent) return fileLivePath;
  return pathUnder(owner.path, belowRoot(fileLivePath));
}

/** Which of a file's headings inside instances a question counts. */
type Counts = (headings: HeadingsInsideInstance) => boolean;
const ROOT_OWNED: Counts = (headings) => headings.isRootOwned;
/** The file that adds a node holds its heading's `owner=`: an override's never reaches the folded node. */
const ADDED: Counts = (headings) => headings.isAdded;

/** Whether `owner`'s file seats a heading that `counts` at `livePath`, placed over the live tree. */
function seatsInsideInstance(owner: ClaimOwner, livePath: string, counts: Counts): boolean {
  const headings = cachedUniqueNameOwnership(owner.roots).insideInstances.get(fileLocalPath(owner, livePath));
  if (headings !== undefined && counts(headings)) return true;
  return uniqueSpeltHeadings(owner.roots).some(
    ([entry, spelt]) => counts(spelt) && owner.live.placed(composedPath(owner, entry)) === livePath
  );
}

/** A file's headings inside instances whose live paths pass through a `%Name`. */
const uniqueSpeltHeadings = perTree((roots): readonly (readonly [string, HeadingsInsideInstance])[] =>
  [...cachedUniqueNameOwnership(roots).insideInstances].filter(([path]) => path.includes(UNIQUE_NODE_PREFIX))
);

/** The nearest file above `owner` that seats a heading `counts` at `livePath`, else `owner`. */
function fileSeating(owner: ClaimOwner, livePath: string, counts: Counts): ClaimOwner {
  for (let above = owner; above.parent; above = above.parent) {
    if (seatsInsideInstance(above.parent, livePath, counts)) return above.parent;
  }
  return owner;
}

/** The live tree with each `%`-spelt live path placed once per walk. */
class PlacedLiveTree {
  /** Written only by `placed`. */
  private readonly placements = new Map<string, string>();

  constructor(readonly tree: LiveTree) {}

  /**
   * `livePath` with each host sub-path through a `%Name` replaced by where the graft placed it, as
   * of its heading (`uniqueParentPlacements`). A path the loaded tree cannot follow keeps the rest
   * as written, and so does a heading its file seats through a `%Name` the graft could not reach.
   */
  placed(livePath: string): string {
    if (!livePath.includes(UNIQUE_NODE_PREFIX)) return livePath;
    const cached = this.placements.get(livePath);
    if (cached !== undefined) return cached;
    let segments = livePath.split('/');
    for (let depth = 0; depth < segments.length; depth++) {
      const link = this.tree.at(segments.slice(0, depth + 1).join('/'));
      if (!link) break;
      const placements = mergedNodeOf(link.groups)?.uniqueParentPlacements;
      if (placements) {
        segments = [...segments.slice(0, depth + 1), ...placedBelow(placements, segments.slice(depth + 1))];
      }
    }
    const placed = segments.join('/');
    this.placements.set(livePath, placed);
    return placed;
  }
}

/** `rest` with its longest leading sub-path that `placements` holds replaced by the placed path. */
function placedBelow(placements: ReadonlyMap<string, string>, rest: readonly string[]): string[] {
  for (let end = rest.length; end > 0; end--) {
    const placed = placements.get(rest.slice(0, end).join('/'));
    if (placed !== undefined) return [...placed.split('/'), ...rest.slice(end)];
  }
  return [...rest];
}

interface Candidate {
  group: LiveChildGroup;
  /** Owner of the nodes in `group`. */
  owner: ClaimOwner;
  /** `subscene` groups: the loaded roots, each the owner of its own descendants. */
  rootOf?: readonly TscnNode[];
}

/**
 * The owner of the node rendered at `path`, walking the composed tree the way
 * the dispatcher builds it. A segment the tree does not (yet) contain keeps the
 * owner found so far, so a consumer inside a not-yet-loaded sub-scene resolves
 * against the outer table until the load lands and the version tick re-asks.
 */
interface Walk {
  /** Owner of the node at the path. */
  owner: ClaimOwner;
  /** Owner of the nodes INSIDE it: the instance itself once its roots are loaded. */
  into: ClaimOwner;
  node?: TscnNode;
}

/** A walk that reached a node, with the groups its children are found in. */
interface Reached extends Walk {
  readonly candidates: readonly Candidate[];
}

/**
 * The owner walk over one live tree, each live path stepped to once however many walks pass
 * through it: the node's own walk, each `%Name` an `owner=` reads, and the walk to that owner.
 */
class OwnerWalk {
  /** Written only by `to`. A null marks a path the loaded tree does not contain. */
  private readonly reached = new Map<string, Reached | null>();
  private readonly root: Reached;

  constructor(readonly live: PlacedLiveTree) {
    const { roots, ctx } = live.tree;
    const outer: ClaimOwner = { path: roots[0]?.name ?? '', roots, live };
    const candidates = rootGroups(roots, ctx).map((group) => ({ group, owner: outer }));
    this.root = { owner: outer, into: outer, candidates };
  }

  to(path: string): Walk {
    let reached = this.root;
    let parentPath = '';
    for (const segment of path.split('/')) {
      const livePath = joinPath(parentPath, segment);
      if (!this.reached.has(livePath)) this.reached.set(livePath, this.step(reached, livePath));
      const next = this.reached.get(livePath);
      if (!next) return { owner: reached.owner, into: reached.owner };
      reached = next;
      parentPath = livePath;
    }
    return reached;
  }

  /** The walk one segment on from `from` to `livePath`, or null where none is there. */
  private step(from: Reached, livePath: string): Reached | null {
    const { live } = this;
    const link = live.tree.at(livePath);
    const found = link && from.candidates.find((candidate) => candidate.group.children.includes(link.node));
    if (!link || !found) return null;
    const node = link.node;
    // A node the file above grafted in is that file's own, however deep it sits.
    const owner = fileSeating(found.owner, livePath, ROOT_OWNED);
    const subRoots = cachedSubRoots(node, link.scope, live.tree.ctx);
    const contentOwner: ClaimOwner = found.rootOf
      ? { path: livePath, roots: found.rootOf, parent: owner, live }
      : owner;
    // The instance node is the root of what it instances, so it owns the GLB's objects too: they sit
    // directly below it (packed_scene.cpp:261-264).
    const instanceOwner = subRoots && { path: livePath, roots: subRoots, parent: owner, live };
    const candidates = link.groups.map((group) => ({
      group,
      owner:
        instanceOwner && holdsInstanceContent(group)
          ? { ...instanceOwner, composed: group.mergedNode?.uniqueNames }
          : contentOwner,
      ...(group.origin === 'subscene' && subRoots ? { rootOf: subRoots } : {}),
    }));
    const into = instanceOwner
      ? (candidates.find((c) => holdsInstanceContent(c.group))?.owner ?? owner)
      : owner;
    return { owner, into, node, candidates };
  }
}

/** A group of what the node instances, which the instance node owns as the root of it. */
function holdsInstanceContent(group: LiveChildGroup): boolean {
  return group.origin === 'merged' || group.origin === 'glb';
}

/** The owner walk over one live tree, built once for it. */
const ownerWalkOver = perObject((tree: LiveTree) => new OwnerWalk(new PlacedLiveTree(tree)));

/** The owner walk every question over `ctx` takes, so each walk shares each step. */
function ownerWalkOf(roots: readonly TscnNode[], ctx: LiveTreeContext): OwnerWalk {
  return ownerWalkOver(liveTreeOf(roots, ctx));
}

/**
 * The owner a `%Name` on the node at `path` registers with: the file the heading is
 * in, except an override heading inside an instance, which the instance keeps
 * (resource_format_text.cpp:264-265). An explicit `owner=` replaces that: `"."` is
 * the root of the file the heading is in, anything else the node at that root-relative path.
 */
export function claimOwnerOf(path: string, roots: readonly TscnNode[], ctx: LiveTreeContext): ClaimOwner {
  const walk = ownerWalkOf(roots, ctx);
  const { owner, node } = walk.to(path);
  if (node?.owner === undefined) return owner;
  const file = fileSeating(owner, path, ADDED);
  if (node.owner === '.') return file;
  const ownerPath = node.owner === NO_OWNER ? undefined : ownerLivePath(file.path, node.owner, walk);
  return ownerPath === undefined ? noOwner(walk.live) : walk.to(ownerPath).into;
}

const NO_NAMES: UniqueNameTable = { paths: () => new Map() };

/** The claim owner of a node with no owner, whose table is empty. */
function noOwner(live: PlacedLiveTree): ClaimOwner {
  return { path: '', roots: [], live, composed: NO_NAMES };
}

/**
 * The live path `owner` names from the file root at `rootPath`, or undefined where it climbs above
 * that root, which `get_node_or_null` answers with null (node.cpp:1919-1922). The seating replaced
 * each `%Name` its own tables answer, so one left here passes through an instance, whose own table
 * answers it, else its owner's (node.cpp:1930-1938).
 */
function ownerLivePath(rootPath: string, owner: string, walk: OwnerWalk): string | undefined {
  let path = rootPath;
  for (const name of nodePathWalkNames(owner)) {
    if (name === '..' && path === rootPath) return undefined;
    const claimant = name.startsWith(UNIQUE_NODE_PREFIX)
      ? localSceneUniquePaths(walk.to(path).into).get(name)
      : undefined;
    path = claimant ?? simplifiedNodePath(joinPath(path, name));
  }
  return path;
}

/**
 * The local scene a local-to-scene resource on the node at `path` is set up against, and so the
 * node its NodePaths measure from: the node itself when it is an instance, else its owner
 * (packed_scene.cpp:707). A scene's own root is its own owner, so the outer root is itself. An
 * explicit `owner=` takes no part: a new node's properties land (:438) before its owner is set
 * (:566-568), so Godot reads no owner and falls back to the file root, and an override keeps
 * the sub-scene owner it already has.
 */
export function localSceneOf(path: string, roots: readonly TscnNode[], ctx: LiveTreeContext): ClaimOwner {
  return ownerWalkOf(roots, ctx).to(path).into;
}

/**
 * The `%Name` table a walk from the local scene root reads: its own table, else its owner's
 * (node.cpp:1930-1938). Only an instance root has an owner, so the outer root's is its own.
 */
export function localSceneUniquePaths(scene: ClaimOwner): UniqueNamePaths {
  const own = ownerUniquePaths(scene);
  if (!scene.parent) return own;
  return new Map([...ownerUniquePaths(scene.parent), ...own]);
}

function cachedSubRoots(
  node: LiveNode,
  scope: SceneScope,
  ctx: LiveTreeContext
): readonly TscnNode[] | undefined {
  const scenePath = liveInstancePath(node, scope);
  return scenePath ? snapshotScenes(ctx).getCached(scenePath)?.nodes : undefined;
}

/** `paths` with each live path placed, the same object where none passes through a `%Name`. */
function withPlacedLivePaths(paths: UniqueNamePaths, live: PlacedLiveTree): UniqueNamePaths {
  if (![...paths.values()].some((path) => path.includes(UNIQUE_NODE_PREFIX))) return paths;
  return new Map([...paths].map(([key, path]) => [key, live.placed(path)]));
}

/**
 * `owner`'s `%Name` table at composed live paths: the one its collapse composed, else its own
 * file's claims. The outer root's own file's table is one shared object per tree.
 */
export function ownerUniquePaths(owner: ClaimOwner): UniqueNamePaths {
  const composed = owner.composed ?? (owner.parent ? undefined : inheritedRootTable(owner));
  if (composed) return withPlacedLivePaths(rebased(composed.paths(), owner.path), owner.live);
  if (!owner.parent) return withPlacedLivePaths(cachedUniqueNameLivePaths(owner.roots), owner.live);
  return withPlacedLivePaths(rebased(cachedUniqueNamesBelowRoot(owner.roots), owner.path), owner.live);
}

/** `paths` from a node, spelt from the root through the node at `path`. */
function rebased(paths: UniqueNamePaths, path: string): UniqueNamePaths {
  return new Map([...paths].map(([key, fromNode]) => [key, simplifiedNodePath(joinPath(path, fromNode))]));
}

/**
 * The table an inherited outer root's collapse composed over its base, which owns the base's
 * names (packed_scene.cpp:227-231), or undefined for a root that inherits nothing loaded.
 */
function inheritedRootTable(outer: ClaimOwner): UniqueNameTable | undefined {
  const root = outer.roots[0];
  if (!root?.instance) return undefined;
  const link = outer.live.tree.at(root.name);
  return link ? mergedNodeOf(link.groups)?.uniqueNames : undefined;
}
