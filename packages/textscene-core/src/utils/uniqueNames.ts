/**
 * `%Name` claims over an authored or composed tree, shared by the linter and the render path. The
 * seating decides which claimant the root's table keeps, and this adds the paths each claim is
 * spelt by and the claims other owners hold.
 */

import type { RawNode } from '../parser/types.js';
import { isInstanceBelowRoot, isOwnedByRoot, isUniqueNameInOwner } from '../parser/nodeOwner.js';
import { sceneSeating } from '../parser/sceneTreeBuilder.js';
import { UNIQUE_NODE_PREFIX } from '../godot/string/nodePath.js';

/** The node a `%Name` addresses, with the two spellings of the path that reaches it. */
export interface UniqueNameClaim {
  readonly node: RawNode;
  /** Where the heading sits in the authored tree: what a `.tscn`-only walk sees. */
  readonly path: string;
  /**
   * Where the node sits once the instanced content its `parent=` addresses into is composed in:
   * `path` with each ancestor's `instanceSubPath` restored, as the render tree spells paths.
   */
  readonly livePath: string;
}

/**
 * What one walk over `roots` learns about ownership: this root's claim table, plus the two facts a
 * per-owner table over composed instanced content is built from.
 */
interface UniqueNameOwnership {
  /** `%Name` → claim, for the nodes this file's root owns. */
  readonly claims: ReadonlyMap<string, UniqueNameClaim>;
  /**
   * Claims on override headings inside instanced content, keyed by the live
   * path of the instance node whose sub-scene root owns them, in file order.
   */
  readonly instanceClaims: ReadonlyMap<string, readonly UniqueNameClaim[]>;
  /** Live paths of nodes this root owns that sit inside instanced content. */
  readonly ownedInsideInstances: ReadonlySet<string>;
}

/**
 * Every `%Name` claimed in `roots`, keyed with the prefix on, with the ownership facts the same
 * walk decides. `path` looks up in an authored tree's `nodeByPath` map, and `livePath`
 * in the composed render tree's.
 */
function uniqueNameOwnership(roots: readonly RawNode[]): UniqueNameOwnership {
  const rootOwned: UniqueNameClaim[] = [];
  const instanceClaims = new Map<string, UniqueNameClaim[]>();
  const ownedInsideInstances = new Set<string>();
  const join = (parent: string, segment: string): string => (parent ? `${parent}/${segment}` : segment);
  // `instanceOwner`: the live path of the nearest ancestor below the root that is an `instance=`
  // heading in this file, or null.
  const walk = (
    nodes: readonly RawNode[],
    parentPath: string,
    parentLive: string,
    instanceOwner: string | null
  ): void => {
    for (const node of nodes) {
      // Two paths, since they diverge at a node whose `parent=` descends into instanced content.
      // Only that node carries `instanceSubPath` (`seatScene` registers it at its authored
      // path), so folding it once is exact.
      const path = join(parentPath, node.name);
      const under = node.instanceSubPath ? join(parentLive, node.instanceSubPath) : parentLive;
      const livePath = join(under, node.name);
      const ownedHere = isOwnedByRoot(node, instanceOwner !== null);
      // A node added inside instanced content is owned by this root.
      if (ownedHere && instanceOwner !== null) ownedInsideInstances.add(livePath);
      if (isUniqueNameInOwner(node)) {
        if (ownedHere) {
          rootOwned.push({ node, path, livePath });
        } else {
          // The node an explicit `owner=` names, or else the instance whose sub-scene root owns the
          // override: `isOwnedByRoot` answers false without an `owner=` only inside an instance.
          const claimOwner = node.owner === undefined ? instanceOwner! : join(roots[0]!.name, node.owner);
          const owned = instanceClaims.get(claimOwner) ?? [];
          owned.push({ node, path, livePath });
          instanceClaims.set(claimOwner, owned);
        }
      }
      // An instanced root is this scene's own root, so its overrides stay claimed. An instance inside
      // the sub-scene is invisible here, so an override below one records under this file's
      // instance, and the composed owner tables re-key it.
      const owner = isInstanceBelowRoot(node, parentPath === '') ? livePath : instanceOwner;
      walk(node.children, path, livePath, owner);
    }
  };
  walk(roots, '', '', null);
  return { claims: rootClaims(roots, rootOwned), instanceClaims, ownedInsideInstances };
}

/** The claims the root's table keeps: for each `%Name`, the claimant the seating resolves it to. */
function rootClaims(
  roots: readonly RawNode[],
  candidates: readonly UniqueNameClaim[]
): Map<string, UniqueNameClaim> {
  const seating = sceneSeating(roots);
  const claims = new Map<string, UniqueNameClaim>();
  for (const claim of candidates) {
    const key = UNIQUE_NODE_PREFIX + claim.node.name;
    const winner = seating.resolve(key);
    if (winner.status === 'found' && winner.node === claim.node) claims.set(key, claim);
  }
  return claims;
}

/** The claim table alone, from {@link uniqueNameOwnership}. */
function uniqueNameClaims(roots: readonly RawNode[]): Map<string, UniqueNameClaim> {
  return uniqueNameOwnership(roots).claims as Map<string, UniqueNameClaim>;
}

/**
 * {@link uniqueNameOwnership} once per `roots` array, shared by the linter and every render
 * consumer. Written only by `cachedUniqueNameOwnership`. A re-parse misses, and an entry dies with
 * its tree.
 */
const ownershipCache = new WeakMap<readonly RawNode[], UniqueNameOwnership>();

export function cachedUniqueNameOwnership(roots: readonly RawNode[]): UniqueNameOwnership {
  let ownership = ownershipCache.get(roots);
  if (!ownership) {
    ownership = uniqueNameOwnership(roots);
    ownershipCache.set(roots, ownership);
  }
  return ownership;
}

export function cachedUniqueNameClaims(roots: readonly RawNode[]): Map<string, UniqueNameClaim> {
  return cachedUniqueNameOwnership(roots).claims as Map<string, UniqueNameClaim>;
}

/**
 * {@link uniqueNameClaims} reduced to `%Name` -> path, for a caller finishing a NodePath walk over
 * a path-keyed node map.
 */
export function uniqueNamePaths(roots: readonly RawNode[]): Map<string, string> {
  const paths = new Map<string, string>();
  for (const [key, claim] of uniqueNameClaims(roots)) paths.set(key, claim.path);
  return paths;
}

/**
 * The same reduction onto `livePath`, for the composed render tree. It takes the table, not the
 * roots: the render path memoises the table per scene graph, and a rebuild per consumer walks the
 * whole scene on every render.
 */
export function uniqueNameLivePaths(
  claims: ReadonlyMap<string, UniqueNameClaim>
): ReadonlyMap<string, string> {
  const paths = new Map<string, string>();
  for (const [key, claim] of claims) paths.set(key, claim.livePath);
  return paths;
}
