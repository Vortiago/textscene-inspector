/**
 * `%Name` claims over a seated tree, shared by the linter and the render path. The seating records
 * every owner's claims (`SeatedPaths.ownership`), and this reduces the root's table to the path
 * spellings a NodePath walk reads.
 */

import type { RawNode } from '../parser/types.js';
import type { UniqueNameClaim, UniqueNameOwnership } from '../parser/nodeOwner.js';
import { sceneSeating } from '../parser/sceneTreeBuilder.js';

/** Every owner's `%Name` claims in `roots`, keyed with the prefix on. One object per tree. */
export function cachedUniqueNameOwnership(roots: readonly RawNode[]): UniqueNameOwnership {
  return sceneSeating(roots).ownership;
}

/** The root's claim table: `path` looks up in an authored tree, and `livePath` in the composed render tree. */
export function cachedUniqueNameClaims(roots: readonly RawNode[]): ReadonlyMap<string, UniqueNameClaim> {
  return cachedUniqueNameOwnership(roots).claims;
}

/**
 * The root's claim table reduced to `%Name` -> path, for a caller finishing a NodePath walk over a
 * path-keyed node map.
 */
export function uniqueNamePaths(roots: readonly RawNode[]): Map<string, string> {
  const paths = new Map<string, string>();
  for (const [key, claim] of cachedUniqueNameClaims(roots)) paths.set(key, claim.path);
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
  return new Map([...claims].map(([key, claim]) => [key, claim.livePath]));
}
