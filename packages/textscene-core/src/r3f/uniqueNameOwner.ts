/**
 * The owner whose `%Name` table a rendered node resolves against, and that
 * table composed over instanced content.
 *
 * `_acquire_unique_name_in_owner` registers a name on the node's OWNER
 * (node.cpp:2222-2234), and `get_node` reads the caller's own table, else its
 * owner's (node.cpp:1930-1938). A sub-scene root owns everything its file
 * declares, plus the outer file's override headings under it
 * (resource_format_text.cpp:264-265); the outer root owns nodes it ADDS under
 * an instance. So each instance root has a table of its own, and an outer
 * consumer never sees it.
 *
 * Pure: walks the composed live tree over a cache snapshot, like
 * `liveSceneTree.ts`, so the React hook only supplies reactivity.
 */

import type { SceneScope, TscnNode } from '../parser/types.js';
import { resolveInstancePath } from '../resources/SubResourceResolver.js';
import { joinPath } from '../utils/nodePath.js';
import {
  UNIQUE_NODE_PREFIX,
  cachedUniqueNameClaims,
  cachedUniqueNameOwnership,
  type UniqueNameClaim,
} from '../utils/uniqueNames.js';
import {
  liveChildGroups,
  rootScope,
  type LiveChildGroup,
  type LiveTreeContext,
} from './liveSceneTree.js';

export interface ClaimOwner {
  /** Live path of the node this owner's root renders at. */
  readonly path: string;
  /** The authored roots of the file this owner is the root of. */
  readonly roots: readonly TscnNode[];
  /** The owner of the instance node itself — the file its heading is in. Absent for the outer root. */
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
  return cachedUniqueNameOwnership(owner.roots).ownedInsideInstances.has(
    fileLocalPath(owner, livePath)
  );
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
  let match: TscnNode | undefined;
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
      if (ownsInsideInstance(above.parent, livePath)) {
        owner = above.parent;
        break;
      }
    }
    // A grafted node resolves its refs against the table it was authored in,
    // as `DispatchedNode` does, not the sub-scene's it now sits in.
    const scope = match.authoredScope ?? found.group.scope;
    const subRoots = cachedSubRoots(match, scope, ctx);
    candidates = liveChildGroups(match, scope, ctx.sceneCache, ctx.glbCache).map((group) => ({
      group,
      owner:
        group.origin === 'merged' && subRoots
          ? { path: livePath, roots: subRoots, parent: owner }
          : found.rootOf
            ? { path: livePath, roots: found.rootOf, parent: owner }
            : owner,
      ...(group.origin === 'subscene' && subRoots ? { rootOf: subRoots } : {}),
    }));
    into = candidates.find((c) => c.group.origin === 'merged')?.owner ?? owner;
    parentPath = livePath;
  }
  return { owner, into, node: match };
}

/**
 * The owner a `%Name` written on the node at `path` registers with, and the
 * table a reference from that node consults.
 *
 * Structurally the file the heading is in owns it, except an override heading
 * inside an instance, which the instance keeps (resource_format_text.cpp:264-265).
 * An explicit `owner=` replaces that answer: `"."` is the root of the file the
 * heading is in, anything else the node at that root-relative path, whose own
 * tree then holds the table.
 */
export function claimOwnerOf(
  path: string,
  roots: readonly TscnNode[],
  ctx: LiveTreeContext
): ClaimOwner {
  const { owner, node } = walkTo(path, roots, ctx);
  if (node?.owner === undefined) return owner;
  // The file an override heading is in is one above the instance that owns it.
  const file = node.overridesExistingNode && owner.parent ? owner.parent : owner;
  if (node.owner === '.') return file;
  return walkTo(joinPath(file.path, node.owner), roots, ctx).into;
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
 * `owner`'s `%Name` table, spelled at composed live paths.
 *
 * The outer root's is the shared cached table. An instance root's is its own
 * file's claims, rebased under the node it collapsed into, then the override
 * claims the file above assigns to it — in that order, because the sub-scene
 * acquires its names while it instantiates (packed_scene.cpp:565-570) and the
 * override's property lands afterwards (:492), and the first claimant keeps the
 * name (node.cpp:2225-2231). The sub-scene root's own flag never registers:
 * :565 acquires only for `owner >= 0`, and a root has none.
 */
export function ownerClaims(owner: ClaimOwner): ReadonlyMap<string, UniqueNameClaim> {
  const own = cachedUniqueNameClaims(owner.roots);
  if (!owner.parent) return own;
  const table = new Map<string, UniqueNameClaim>();
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
