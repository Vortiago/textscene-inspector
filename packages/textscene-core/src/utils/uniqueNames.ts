/**
 * `%Name` claims over an authored tree — the one place that decides which node a
 * unique name addresses.
 *
 * `_acquire_unique_name_in_owner` (node.cpp:2222) registers `"%" + name` on the
 * node's OWNER — the scene root for every heading this file declares, the
 * sub-scene root for an override inside instanced content — and refuses to overwrite
 * an existing entry (node.cpp:2225-2231): the first claimant keeps the name and
 * the later one has its flag cleared. So the claim table is exactly the nodes in
 * this file carrying the flag, first one wins, and a `%Name` with no claimant
 * really does address nothing.
 *
 * Shared by the linter's NodePath walk and the render path's relay/`path_node`
 * resolution. Both ask the same question, and two copies would answer it
 * differently on the tree shape each happens to hold.
 */

import type { TscnNode } from '../parser/types.js';
import { boolSlotValue } from '../godot/index.js';

/** `UNIQUE_NODE_PREFIX` (string_name.h:36). */
export const UNIQUE_NODE_PREFIX = '%';

/** The node a `%Name` addresses, with the two spellings of the path that reaches it. */
export interface UniqueNameClaim {
  readonly node: TscnNode;
  /** Where the heading sits in the AUTHORED tree — what a `.tscn`-only walk sees. */
  readonly path: string;
  /**
   * Where the node sits once the instanced content its `parent=` addresses INTO
   * is composed in: `path` with each ancestor's `instanceSubPath` segments
   * restored. The render tree spells paths this way, so a caller matching a
   * claim against a rendered node's path wants this one.
   */
  readonly livePath: string;
}

/**
 * `unique_name_in_owner = true` on this node (node.cpp:4050 — `PROPERTY_USAGE_NO_EDITOR`
 * hides it from the inspector and still serialises it).
 *
 * `rawProperties` and nothing else: both parsers publish the raw bag there
 * (`parser/rawPropertyParity.test.ts`), and it is the only field whose meaning
 * does not depend on which one produced the node. No slice models this flag, so
 * on the render tree the typed `properties` never carries it at all.
 */
export function isUniqueNameInOwner(node: TscnNode): boolean {
  return boolSlotValue(node.rawProperties?.unique_name_in_owner) === true;
}

/**
 * What one walk over `roots` learns about ownership — the claim table this
 * root holds, plus the two things a per-owner table over composed instanced
 * content is built from.
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
 * Every `%Name` claimed in `roots`, depth-first, keyed with the prefix already on,
 * with the ownership facts the same walk decides.
 *
 * Paths are joined the way the walks over the same tree spell them, so a caller can
 * look the result straight up in its `nodeByPath` map — `path` for a walk over the
 * authored tree, `livePath` for one over the composed render tree.
 */
export function uniqueNameOwnership(roots: readonly TscnNode[]): UniqueNameOwnership {
  const claims = new Map<string, UniqueNameClaim>();
  const instanceClaims = new Map<string, UniqueNameClaim[]>();
  const ownedInsideInstances = new Set<string>();
  const join = (parent: string, segment: string): string =>
    parent ? `${parent}/${segment}` : segment;
  // Two accumulators, because the two paths diverge at a node whose `parent=`
  // descends into instanced content and never re-converge below it. Only that
  // node carries the marker — `buildSceneTree` registers it at its authored path
  // so its own descendants resolve normally — so folding it once is exact.
  // `instanceOwner`: the live path of the nearest ancestor below the root that
  // is an `instance=` heading in THIS file, or null. A heading under it with
  // neither `type=` nor `instance=` overrides a node the sub-scene already
  // owns, and resource_format_text.cpp:264-265 leaves that owner alone
  // (`owner = 0` only when `!(type == TYPE_INSTANTIATED && instance == -1)`),
  // so its `%Name` lands on the sub-scene root's table (node.cpp:2222-2233),
  // which `get_node` from this scene never consults (node.cpp:1930-1938); it
  // is recorded under that instance for the owner's table to pick up. An
  // added node there is owned by this root as usual. An instanced ROOT is this
  // scene's own root, so its overrides stay claimed. An explicit `owner=` on the
  // heading replaces the structural answer: `"."` is this root, anything else
  // the node at that root-relative path. An instance the sub-scene itself
  // contains is invisible here, so an override of a node below one is recorded
  // under the instance this file declares; the composed owner tables re-key it.
  const walk = (
    nodes: readonly TscnNode[],
    parentPath: string,
    parentLive: string,
    instanceOwner: string | null
  ): void => {
    for (const node of nodes) {
      const path = join(parentPath, node.name);
      const under = node.instanceSubPath ? join(parentLive, node.instanceSubPath) : parentLive;
      const livePath = join(under, node.name);
      const key = UNIQUE_NODE_PREFIX + node.name;
      const explicitOwner =
        node.owner === undefined ? undefined : node.owner === '.' ? null : join(roots[0]!.name, node.owner);
      const claimOwner =
        explicitOwner !== undefined
          ? explicitOwner
          : instanceOwner !== null && node.overridesExistingNode === true
            ? instanceOwner
            : null;
      const ownedHere = claimOwner === null;
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
      const owner = parentPath !== '' && node.instance ? livePath : instanceOwner;
      walk(node.children, path, livePath, owner);
    }
  };
  walk(roots, '', '', null);
  return { claims, instanceClaims, ownedInsideInstances };
}

/** The claim table alone — see {@link uniqueNameOwnership}. */
export function uniqueNameClaims(roots: readonly TscnNode[]): Map<string, UniqueNameClaim> {
  return uniqueNameOwnership(roots).claims as Map<string, UniqueNameClaim>;
}

/**
 * {@link uniqueNameOwnership} built once per tree and shared by every caller
 * holding the same `roots` array — the linter's NodePath walk and each render
 * consumer alike. Keyed on the array a parse produces, so a re-parse misses and
 * an entry dies with its tree.
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
 * {@link uniqueNameClaims} reduced to `%Name` -> path, which is what a caller
 * holding a path-keyed node map needs to finish a NodePath walk.
 */
export function uniqueNamePaths(roots: readonly TscnNode[]): Map<string, string> {
  const paths = new Map<string, string>();
  for (const [key, claim] of uniqueNameClaims(roots)) paths.set(key, claim.path);
  return paths;
}

/**
 * The same reduction onto `livePath`, for a caller resolving against the
 * COMPOSED render tree rather than the authored one.
 *
 * Takes the resolved table rather than the roots: the render path memoizes that
 * table per scene graph and rebuilding it per consumer would walk the whole
 * scene again on every render.
 */
export function uniqueNameLivePaths(
  claims: ReadonlyMap<string, UniqueNameClaim>
): ReadonlyMap<string, string> {
  const paths = new Map<string, string>();
  for (const [key, claim] of claims) paths.set(key, claim.livePath);
  return paths;
}
