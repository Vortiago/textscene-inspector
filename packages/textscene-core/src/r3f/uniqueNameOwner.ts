/**
 * The owner whose `%Name` table a rendered node resolves against, that table at composed live
 * paths, and the local scene a local-to-scene resource on the node measures from. Each instance
 * root has a table of its own, which an outer consumer never sees (`uniqueNameOwner.md`). The
 * collapse composes an instance's table, and this reads it. Pure: it walks the composed live tree
 * over a cache snapshot, like `liveSceneTree.ts`, and the React hooks supply reactivity.
 */

import type { SceneScope, TscnNode } from '../parser/types.js';
import { resolveInstancePath } from '../resources/SubResourceResolver.js';
import { joinPath } from '../utils/nodePath.js';
import { UNIQUE_NODE_PREFIX } from '../godot/string/nodePath.js';
import {
  cachedUniqueNameLivePaths,
  cachedUniqueNameOwnership,
  cachedUniqueNamesBelowRoot,
} from '../utils/uniqueNames.js';
import type { UniqueNamePaths, UniqueNameTable } from '../resources/instanceNameTable.js';
import {
  liveChildGroups,
  liveChildNamed,
  mergedNodeOf,
  rootScope,
  type LiveChildGroup,
  type LiveTreeContext,
} from './liveSceneTree.js';
import { scopeOf, type LiveNode } from '../resources/liveNode.js';
import { GLB_SCENE_ROOT_TYPE } from '../resources/glbSceneRoot.js';

interface ClaimOwner {
  /** Live path of the node this owner's root renders at. */
  readonly path: string;
  /** The authored roots of the file this owner is the root of. */
  readonly roots: readonly TscnNode[];
  /** The owner of the instance node itself: the file its heading is in. Absent for the outer root. */
  readonly parent?: ClaimOwner;
  /** The live tree, carried by the outer root alone so a live path can be placed over it. */
  readonly ctx?: LiveTreeContext;
  /** The table the collapse composed, on an instance that collapses into its sub-scene root. */
  readonly composed?: UniqueNameTable;
}

/** A composed live path spelled the way `owner`'s own file spells it. */
function fileLocalPath(owner: ClaimOwner, livePath: string): string {
  if (!owner.parent) return livePath;
  return owner.roots[0]!.name + livePath.slice(owner.path.length);
}

/** The inverse: a live path from `owner`'s file, composed under its render path. */
function composedPath(owner: ClaimOwner, fileLivePath: string): string {
  if (!owner.parent) return fileLivePath;
  return owner.path + fileLivePath.slice(fileLivePath.indexOf('/'));
}

function ownsInsideInstance(owner: ClaimOwner, livePath: string, outer: ClaimOwner): boolean {
  if (cachedUniqueNameOwnership(owner.roots).ownedInsideInstances.has(fileLocalPath(owner, livePath)))
    return true;
  return uniqueSpeltOwnedPaths(owner.roots).some(
    (entry) => placedLivePath(composedPath(owner, entry), outer) === livePath
  );
}

/** Written only by `uniqueSpeltOwnedPaths`, once per file's roots. */
const uniqueSpeltOwned = new WeakMap<readonly TscnNode[], readonly string[]>();

/** The live paths of nodes a file owns inside instances that pass through a `%Name`. */
function uniqueSpeltOwnedPaths(roots: readonly TscnNode[]): readonly string[] {
  let paths = uniqueSpeltOwned.get(roots);
  if (!paths) {
    const owned = cachedUniqueNameOwnership(roots).ownedInsideInstances;
    paths = [...owned].filter((path) => path.includes(UNIQUE_NODE_PREFIX));
    uniqueSpeltOwned.set(roots, paths);
  }
  return paths;
}

/**
 * `livePath` with each host sub-path through a `%Name` replaced by where the graft placed it, as of
 * its heading (`uniqueParentPlacements`). A path the loaded tree cannot follow keeps the rest as
 * written, and so does a heading its file seats through a `%Name` the graft could not reach.
 */
function placedLivePath(livePath: string, outer: ClaimOwner): string {
  if (!livePath.includes(UNIQUE_NODE_PREFIX) || !outer.ctx) return livePath;
  const { ctx } = outer;
  let segments = livePath.split('/');
  let groups: readonly LiveChildGroup[] = [
    { origin: 'inline', children: outer.roots, scope: rootScope(ctx) },
  ];
  for (let depth = 0; depth < segments.length; depth++) {
    const found = liveChildNamed(groups, segments[depth]!);
    if (!found) break;
    groups = liveChildGroups(found.node, found.scope, ctx.sceneCache, ctx.glbCache);
    const placements = mergedNodeOf(groups)?.uniqueParentPlacements;
    if (placements) {
      segments = [...segments.slice(0, depth + 1), ...placedBelow(placements, segments.slice(depth + 1))];
    }
  }
  return segments.join('/');
}

/** `rest` with its longest leading sub-path that `placements` holds replaced by the placed path. */
function placedBelow(placements: ReadonlyMap<string, string>, rest: readonly string[]): string[] {
  for (let end = rest.length; end > 0; end--) {
    const placed = placements.get(rest.slice(0, end).join('/'));
    if (placed !== undefined) return [...placed.split('/'), ...rest.slice(end)];
  }
  return [...rest];
}

/** The outer root's owner, which carries the live tree. */
function outerOf(owner: ClaimOwner): ClaimOwner {
  let outer = owner;
  while (outer.parent) outer = outer.parent;
  return outer;
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

function walkTo(path: string, roots: readonly TscnNode[], ctx: LiveTreeContext): Walk {
  const outer: ClaimOwner = { path: roots[0]?.name ?? '', roots, ctx };
  let candidates: Candidate[] = [
    { group: { origin: 'inline', children: roots, scope: rootScope(ctx) }, owner: outer },
  ];
  let owner = outer;
  let into = outer;
  let parentPath = '';
  let match: LiveNode | undefined;
  for (const segment of path.split('/')) {
    let found: Candidate | undefined;
    match = undefined;
    for (const candidate of candidates) {
      match = candidate.group.children.find((n) => n.name === segment);
      if (match) {
        found = candidate;
        break;
      }
    }
    if (!match || !found) return { owner, into: owner };
    const livePath = joinPath(parentPath, segment);
    owner = found.owner;
    // A node the file above grafted in is that file's own, however deep it sits.
    for (let above = owner; above.parent; above = above.parent) {
      if (ownsInsideInstance(above.parent, livePath, outer)) {
        owner = above.parent;
        break;
      }
    }
    const scope = scopeOf(match, found.group.scope);
    const subRoots = cachedSubRoots(match, scope, ctx);
    // In Godot a GLB root is its instance node, which owns the imported nodes. This tree renders
    // the GLB root one segment below the instance, so the owner's path is the instance's, `parentPath`.
    const isGlbRoot = found.rootOf !== undefined && match.type === GLB_SCENE_ROOT_TYPE;
    const contentOwner: ClaimOwner = found.rootOf
      ? { path: isGlbRoot ? parentPath : livePath, roots: found.rootOf, parent: owner }
      : owner;
    candidates = liveChildGroups(match, scope, ctx.sceneCache, ctx.glbCache).map((group) => ({
      group,
      owner:
        group.origin === 'merged' && subRoots
          ? { path: livePath, roots: subRoots, parent: owner, composed: group.mergedNode?.uniqueNames }
          : contentOwner,
      ...(group.origin === 'subscene' && subRoots ? { rootOf: subRoots } : {}),
    }));
    into = isGlbRoot ? contentOwner : (candidates.find((c) => c.group.origin === 'merged')?.owner ?? owner);
    parentPath = livePath;
  }
  return { owner, into, node: match };
}

/**
 * The owner a `%Name` on the node at `path` registers with: the file the heading is
 * in, except an override heading inside an instance, which the instance keeps
 * (resource_format_text.cpp:264-265). An explicit `owner=` replaces that: `"."` is
 * that file's root, anything else the node at that root-relative path.
 */
export function claimOwnerOf(path: string, roots: readonly TscnNode[], ctx: LiveTreeContext): ClaimOwner {
  const { owner, node } = walkTo(path, roots, ctx);
  if (node?.owner === undefined) return owner;
  // The file an override heading is in is one above the instance that owns it.
  const file = node.overridesExistingNode && owner.parent ? owner.parent : owner;
  if (node.owner === '.') return file;
  return walkTo(joinPath(file.path, node.owner), roots, ctx).into;
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
  return walkTo(path, roots, ctx).into;
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
  node: TscnNode,
  scope: SceneScope,
  ctx: LiveTreeContext
): readonly TscnNode[] | undefined {
  if (!node.instance) return undefined;
  const scenePath = resolveInstancePath(node.instance, scope.externalResources);
  return scenePath ? ctx.sceneCache.getCached(scenePath)?.nodes : undefined;
}

/** `paths` with each live path placed, the same object where none passes through a `%Name`. */
function withPlacedLivePaths(paths: UniqueNamePaths, outer: ClaimOwner): UniqueNamePaths {
  if (![...paths.values()].some((path) => path.includes(UNIQUE_NODE_PREFIX))) return paths;
  return new Map([...paths].map(([key, path]) => [key, placedLivePath(path, outer)]));
}

/**
 * `owner`'s `%Name` table at composed live paths: the one its collapse composed, else its own
 * file's claims. The outer root's own file's table is one shared object per tree.
 */
export function ownerUniquePaths(owner: ClaimOwner): UniqueNamePaths {
  const outer = outerOf(owner);
  const composed = owner.parent ? owner.composed : inheritedRootTable(owner);
  if (composed) return withPlacedLivePaths(rebased(composed.paths(), owner.path), outer);
  if (!owner.parent) return withPlacedLivePaths(cachedUniqueNameLivePaths(owner.roots), outer);
  return withPlacedLivePaths(rebased(cachedUniqueNamesBelowRoot(owner.roots), owner.path), outer);
}

/** `paths` below a node, spelt from the root through the node at `path`. */
function rebased(paths: UniqueNamePaths, path: string): UniqueNamePaths {
  return new Map([...paths].map(([key, below]) => [key, joinPath(path, below)]));
}

/**
 * The table an inherited outer root's collapse composed over its base, which owns the base's
 * names (packed_scene.cpp:227-231), or undefined for a root that inherits nothing loaded.
 */
function inheritedRootTable(outer: ClaimOwner): UniqueNameTable | undefined {
  const root = outer.roots[0];
  if (!root?.instance || !outer.ctx) return undefined;
  const { ctx } = outer;
  return mergedNodeOf(liveChildGroups(root, rootScope(ctx), ctx.sceneCache, ctx.glbCache))?.uniqueNames;
}
