/**
 * `%Name` claims over a seated tree, shared by the linter and the render path. The seating records
 * the root's claims (`SeatedPaths.ownership`), and this reduces that table to the path spellings a
 * NodePath walk reads.
 */

import type { RawNode } from '../parser/types.js';
import type { UniqueNameOwnership } from '../parser/nodeOwner.js';
import { sceneSeating } from '../parser/sceneTreeBuilder.js';

/** The root's `%Name` claims in `roots`, keyed with the prefix on. One object per tree. */
export function cachedUniqueNameOwnership(roots: readonly RawNode[]): UniqueNameOwnership {
  return sceneSeating(roots).ownership;
}

/**
 * The root's claim table reduced to `%Name` -> path, for a caller finishing a NodePath walk over a
 * path-keyed node map.
 */
export function uniqueNamePaths(roots: readonly RawNode[]): Map<string, string> {
  const paths = new Map<string, string>();
  for (const [key, claim] of cachedUniqueNameOwnership(roots).claims) paths.set(key, claim.path);
  return paths;
}

/** A per-tree table, built once for each roots array the returned reader is called with. */
export function perTree<T>(build: (roots: readonly RawNode[]) => T): (roots: readonly RawNode[]) => T {
  const built = new WeakMap<readonly RawNode[], T>();
  return (roots) => {
    if (!built.has(roots)) built.set(roots, build(roots));
    return built.get(roots)!;
  };
}

/** The same reduction onto `livePath`, for the composed render tree. One object per tree. */
export const cachedUniqueNameLivePaths = perTree(
  (roots): ReadonlyMap<string, string> =>
    new Map([...cachedUniqueNameOwnership(roots).claims].map(([key, claim]) => [key, claim.livePath]))
);

/**
 * The live paths again, spelt below the root, as an instance of the scene holds them. The root
 * claims nothing (it has no owner), so each path continues below it. One object per tree.
 */
export const cachedUniqueNamesBelowRoot = perTree(
  (roots): ReadonlyMap<string, string> =>
    new Map(
      [...cachedUniqueNameLivePaths(roots)].map(([key, path]) => [key, path.slice(path.indexOf('/') + 1)])
    )
);
