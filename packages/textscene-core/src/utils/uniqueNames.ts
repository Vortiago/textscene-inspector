/**
 * `%Name` claims over an authored tree, shared by the linter's NodePath walk and the render path.
 * `_acquire_unique_name_in_owner` (node.cpp:2222) registers `"%" + name` on the node's owner and
 * refuses to overwrite an entry (node.cpp:2225-2231), so the first claimant wins and a `%Name`
 * with no claimant addresses nothing.
 */

import type { TscnNode } from '../parser/types.js';
import { boolSlotValue } from '../godot/index.js';

/** `UNIQUE_NODE_PREFIX` (string_name.h:36). */
export const UNIQUE_NODE_PREFIX = '%';

/** The node a `%Name` addresses, with the two spellings of the path that reaches it. */
export interface UniqueNameClaim {
  readonly node: TscnNode;
  /** Where the heading sits in the authored tree: what a `.tscn`-only walk sees. */
  readonly path: string;
  /**
   * Where the node sits once the instanced content its `parent=` addresses into is composed in:
   * `path` with each ancestor's `instanceSubPath` restored, as the render tree spells paths.
   */
  readonly livePath: string;
}

/**
 * `unique_name_in_owner = true` on this node (node.cpp:4050: `PROPERTY_USAGE_NO_EDITOR` hides it
 * and still serialises it). Read from `rawProperties` alone, which both parsers publish alike
 * (`parser/rawPropertyParity.test.ts`). No slice models the flag, so typed `properties` lacks it.
 */
export function isUniqueNameInOwner(node: TscnNode): boolean {
  return boolSlotValue(node.rawProperties?.unique_name_in_owner) === true;
}

/**
 * What one walk over `roots` learns about ownership: this root's claim table, plus the two facts a
 * per-owner table over composed instanced content is built from.
 */
export interface UniqueNameOwnership {
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
 * Every `%Name` claimed in `roots`, depth-first, keyed with the prefix on, with the ownership facts
 * the same walk decides. `path` looks up in an authored tree's `nodeByPath` map, and `livePath`
 * in the composed render tree's.
 */
export function uniqueNameOwnership(roots: readonly TscnNode[]): UniqueNameOwnership {
  const claims = new Map<string, UniqueNameClaim>();
  const instanceClaims = new Map<string, UniqueNameClaim[]>();
  const ownedInsideInstances = new Set<string>();
  const join = (parent: string, segment: string): string =>
    parent ? `${parent}/${segment}` : segment;
  // `instanceOwner`: the live path of the nearest ancestor below the root that is an `instance=`
  // heading in this file, or null.
  const walk = (
    nodes: readonly TscnNode[],
    parentPath: string,
    parentLive: string,
    instanceOwner: string | null
  ): void => {
    for (const node of nodes) {
      // Two paths, since they diverge at a node whose `parent=` descends into instanced content.
      // Only that node carries `instanceSubPath` (`buildSceneTree` registers it at its authored
      // path), so folding it once is exact.
      const path = join(parentPath, node.name);
      const under = node.instanceSubPath ? join(parentLive, node.instanceSubPath) : parentLive;
      const livePath = join(under, node.name);
      const key = UNIQUE_NODE_PREFIX + node.name;
      // An explicit `owner=` replaces the structural answer: `"."` is this root, anything else the
      // node at that root-relative path.
      const explicitOwner =
        node.owner === undefined ? undefined : node.owner === '.' ? null : join(roots[0]!.name, node.owner);
      // An override under an instance keeps the sub-scene's owner: resource_format_text.cpp:264-265
      // zeroes `owner` only when `!(type == TYPE_INSTANTIATED && instance == -1)`. Its `%Name` lands
      // on the sub-scene root's table (node.cpp:2222-2233), which `get_node` here never consults
      // (node.cpp:1930-1938), so it records under that instance for the owner's table.
      const claimOwner =
        explicitOwner !== undefined
          ? explicitOwner
          : instanceOwner !== null && node.overridesExistingNode === true
            ? instanceOwner
            : null;
      const ownedHere = claimOwner === null;
      // A node added inside instanced content is owned by this root.
      if (ownedHere && instanceOwner !== null) ownedInsideInstances.add(livePath);
      if (isUniqueNameInOwner(node)) {
        if (!ownedHere) {
          const owned = instanceClaims.get(claimOwner) ?? [];
          owned.push({ node, path, livePath });
          instanceClaims.set(claimOwner, owned);
        } else if (!claims.has(key)) {
          claims.set(key, { node, path, livePath });
        }
      }
      // An instanced root is this scene's own root, so its overrides stay claimed. An instance inside
      // the sub-scene is invisible here, so an override below one records under this file's
      // instance, and the composed owner tables re-key it.
      const owner = parentPath !== '' && node.instance ? livePath : instanceOwner;
      walk(node.children, path, livePath, owner);
    }
  };
  walk(roots, '', '', null);
  return { claims, instanceClaims, ownedInsideInstances };
}

/** The claim table alone, from {@link uniqueNameOwnership}. */
export function uniqueNameClaims(roots: readonly TscnNode[]): Map<string, UniqueNameClaim> {
  return uniqueNameOwnership(roots).claims as Map<string, UniqueNameClaim>;
}

/**
 * {@link uniqueNameOwnership} once per `roots` array, shared by the linter and every render
 * consumer. Written only by `cachedUniqueNameOwnership`. A re-parse misses, and an entry dies with
 * its tree.
 */
const ownershipCache = new WeakMap<readonly TscnNode[], UniqueNameOwnership>();

export function cachedUniqueNameOwnership(roots: readonly TscnNode[]): UniqueNameOwnership {
  let ownership = ownershipCache.get(roots);
  if (!ownership) {
    ownership = uniqueNameOwnership(roots);
    ownershipCache.set(roots, ownership);
  }
  return ownership;
}

export function cachedUniqueNameClaims(roots: readonly TscnNode[]): Map<string, UniqueNameClaim> {
  return cachedUniqueNameOwnership(roots).claims as Map<string, UniqueNameClaim>;
}

/**
 * {@link uniqueNameClaims} reduced to `%Name` -> path, for a caller finishing a NodePath walk over
 * a path-keyed node map.
 */
export function uniqueNamePaths(roots: readonly TscnNode[]): Map<string, string> {
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
