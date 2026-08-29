/**
 * `%Name` claims over an authored tree — the one place that decides which node a
 * unique name addresses.
 *
 * `_acquire_unique_name_in_owner` (node.cpp:2222) registers `"%" + name` on the
 * node's OWNER, which for a `.tscn` is the scene root, and refuses to overwrite
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
 * Every `%Name` claimed in `roots`, depth-first, keyed with the prefix already on.
 *
 * Paths are joined the way the walks over the same tree spell them, so a caller can
 * look the result straight up in its `nodeByPath` map — `path` for a walk over the
 * authored tree, `livePath` for one over the composed render tree.
 */
export function uniqueNameClaims(roots: readonly TscnNode[]): Map<string, UniqueNameClaim> {
  const claims = new Map<string, UniqueNameClaim>();
  const join = (parent: string, segment: string): string =>
    parent ? `${parent}/${segment}` : segment;
  // Two accumulators, because the two paths diverge at a node whose `parent=`
  // descends into instanced content and never re-converge below it. Only that
  // node carries the marker — `buildSceneTree` registers it at its authored path
  // so its own descendants resolve normally — so folding it once is exact.
  const walk = (nodes: readonly TscnNode[], parentPath: string, parentLive: string): void => {
    for (const node of nodes) {
      const path = join(parentPath, node.name);
      const under = node.instanceSubPath ? join(parentLive, node.instanceSubPath) : parentLive;
      const livePath = join(under, node.name);
      const key = UNIQUE_NODE_PREFIX + node.name;
      if (isUniqueNameInOwner(node) && !claims.has(key)) claims.set(key, { node, path, livePath });
      walk(node.children, path, livePath);
    }
  };
  walk(roots, '', '');
  return claims;
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
