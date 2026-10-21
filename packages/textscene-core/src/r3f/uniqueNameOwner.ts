/**
 * The owner whose `%Name` table a rendered node resolves against, that table composed over
 * instanced content, and the local scene a local-to-scene resource on the node measures from.
 * Each instance root has a table of its own, which an outer consumer never sees
 * (`uniqueNameOwner.md`). Pure: it walks the composed live tree over a cache snapshot, like
 * `liveSceneTree.ts`, and the React hooks supply reactivity.
 */

import type { SceneScope, TscnNode } from '../parser/types.js';
import { resolveInstancePath } from '../resources/SubResourceResolver.js';
import { joinPath } from '../utils/nodePath.js';
import { UNIQUE_NODE_PREFIX } from '../godot/string/nodePath.js';
import {
  cachedUniqueNameClaims,
  cachedUniqueNameOwnership,
  type UniqueNameClaim,
} from '../utils/uniqueNames.js';
import { walkLivePath, type LiveChildGroup, type LiveTreeContext } from './liveSceneTree.js';
import { GLB_SCENE_ROOT_TYPE } from '../resources/glbSceneRoot.js';

interface ClaimOwner {
  /** Live path of the node this owner's root renders at. */
  readonly path: string;
  /** The authored roots of the file this owner is the root of. */
  readonly roots: readonly TscnNode[];
  /** The owner of the instance node itself: the file its heading is in. Absent for the outer root. */
  readonly parent?: ClaimOwner;
  /** The live tree, carried by the outer root alone so a table can re-walk it. */
  readonly ctx?: LiveTreeContext;
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

function ownsInsideInstance(owner: ClaimOwner, livePath: string): boolean {
  return cachedUniqueNameOwnership(owner.roots).ownedInsideInstances.has(fileLocalPath(owner, livePath));
}

/** Who owns the nodes of one live-tree group. */
interface GroupOwnership {
  /** Owner of the nodes in the group. */
  owner: ClaimOwner;
  /** `subscene` groups: the loaded roots, each the owner of its own descendants. */
  rootOf?: readonly TscnNode[];
}

/** What {@link walkTo} found: the owners at the path, and the node when the path resolved. */
interface Walk {
  /** Owner of the node at the path. */
  owner: ClaimOwner;
  /** Owner of the nodes INSIDE it: the instance itself once its roots are loaded. */
  into: ClaimOwner;
  node?: TscnNode;
}

/**
 * The owner of the node rendered at `path`, walking the composed tree the way
 * the dispatcher builds it. A segment the tree does not (yet) contain keeps the
 * owner found so far, so a consumer inside a not-yet-loaded sub-scene resolves
 * against the outer table until the load lands and the version tick re-asks.
 */
function walkTo(path: string, roots: readonly TscnNode[], ctx: LiveTreeContext): Walk {
  const outer: ClaimOwner = { path: roots[0]?.name ?? '', roots, ctx };
  const { links, isResolved } = walkLivePath(path, roots, ctx);
  const ownership = new Map<LiveChildGroup, GroupOwnership>();
  if (links[0]) ownership.set(links[0].group, { owner: outer });
  let owner = outer;
  let into = outer;
  let parentPath = '';
  for (const link of links) {
    const found = ownership.get(link.group)!;
    const livePath = joinPath(parentPath, link.raw.name);
    owner = found.owner;
    // A node the file above grafted in is that file's own, however deep it sits.
    for (let above = owner; above.parent; above = above.parent) {
      if (ownsInsideInstance(above.parent, livePath)) {
        owner = above.parent;
        break;
      }
    }
    const subRoots = cachedSubRoots(link.raw, link.scope, ctx);
    // In Godot a GLB root is its instance node, which owns the imported nodes. This tree renders
    // the GLB root one segment below the instance, so the owner's path is the instance's, `parentPath`.
    const isGlbRoot = found.rootOf !== undefined && link.raw.type === GLB_SCENE_ROOT_TYPE;
    const contentOwner: ClaimOwner = found.rootOf
      ? { path: isGlbRoot ? parentPath : livePath, roots: found.rootOf, parent: owner }
      : owner;
    for (const group of link.groups) {
      ownership.set(group, {
        owner:
          group.origin === 'merged' && subRoots
            ? { path: livePath, roots: subRoots, parent: owner }
            : contentOwner,
        ...(group.origin === 'subscene' && subRoots ? { rootOf: subRoots } : {}),
      });
    }
    const mergedGroup = link.groups.find((group) => group.origin === 'merged');
    into = isGlbRoot ? contentOwner : ((mergedGroup && ownership.get(mergedGroup)?.owner) ?? owner);
    parentPath = livePath;
  }
  if (!isResolved) return { owner, into: owner };
  return { owner, into, node: links[links.length - 1]!.raw };
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
export function localSceneClaims(scene: ClaimOwner): ReadonlyMap<string, UniqueNameClaim> {
  const own = ownerClaims(scene);
  if (!scene.parent) return own;
  return new Map([...ownerClaims(scene.parent), ...own]);
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

/**
 * `owner`'s `%Name` table at composed live paths. The outer root's is the shared
 * cached table. An instance root's is its own file's claims, rebased under the node
 * it collapsed into, then the override claims the file above assigns to it.
 */
export function ownerClaims(owner: ClaimOwner): ReadonlyMap<string, UniqueNameClaim> {
  const own = cachedUniqueNameClaims(owner.roots);
  if (!owner.parent) return own;
  const table = new Map<string, UniqueNameClaim>();
  // Own claims first: the sub-scene acquires its names while it instantiates
  // (packed_scene.cpp:565-570), the override's property lands afterwards (:492), and
  // the first claimant keeps the name (node.cpp:2225-2231). The sub-scene root's own
  // flag never registers: :565 acquires only for `owner >= 0`, and a root has none.
  for (const [key, claim] of own) {
    if (!claim.livePath.includes('/')) continue;
    table.set(key, { ...claim, livePath: composedPath(owner, claim.livePath) });
  }
  let outer = owner;
  while (outer.parent) outer = outer.parent;
  // A file records an override's claim under the instance IT declares, which is
  // the nearest owner it can see; the composed tree knows the nearest one there
  // is, so every ancestor's records are re-keyed by the owner the node has here.
  // An explicit `owner=` named its table outright and is filed by that key.
  for (let above: ClaimOwner | undefined = owner.parent; above; above = above.parent) {
    for (const [key, claims] of cachedUniqueNameOwnership(above.roots).instanceClaims) {
      for (const claim of claims) {
        const name = UNIQUE_NODE_PREFIX + claim.node.name;
        if (table.has(name)) continue;
        const livePath = composedPath(above, claim.livePath);
        const ownedBy =
          claim.node.owner !== undefined || !outer.ctx
            ? composedPath(above, key)
            : walkTo(livePath, outer.roots, outer.ctx).owner.path;
        if (ownedBy !== owner.path) continue;
        table.set(name, { ...claim, livePath });
      }
    }
  }
  return table;
}
