/**
 * `%Name` claims over a seated tree, shared by the linter and the render path. The seating records
 * every owner's claims (`SeatedPaths.ownership`), and this reduces the root's table to the path
 * spellings a NodePath walk reads.
 */

import type { RawNode } from '../parser/types.js';
import type { UniqueNameOwnership } from '../parser/nodeOwner.js';
import { sceneSeating } from '../parser/sceneTreeBuilder.js';

/** Every owner's `%Name` claims in `roots`, keyed with the prefix on. One object per tree. */
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

/** Written only by `cachedUniqueNameLivePaths`, once per tree. */
const livePaths = new WeakMap<readonly RawNode[], ReadonlyMap<string, string>>();

/** The same reduction onto `livePath`, for the composed render tree. One object per tree. */
export function cachedUniqueNameLivePaths(roots: readonly RawNode[]): ReadonlyMap<string, string> {
  let paths = livePaths.get(roots);
  if (!paths) {
    paths = new Map(
      [...cachedUniqueNameOwnership(roots).claims].map(([key, claim]) => [key, claim.livePath])
    );
    livePaths.set(roots, paths);
  }
  return paths;
}

/** Written only by `cachedUniqueNamesBelowRoot`, once per tree. */
const belowRoot = new WeakMap<readonly RawNode[], ReadonlyMap<string, string>>();

/**
 * The live paths again, spelt below the root, as an instance of the scene holds them. The root
 * claims nothing (it has no owner), so each path continues below it.
 */
export function cachedUniqueNamesBelowRoot(roots: readonly RawNode[]): ReadonlyMap<string, string> {
  let paths = belowRoot.get(roots);
  if (!paths) {
    const live = [...cachedUniqueNameLivePaths(roots)];
    paths = new Map(live.map(([key, path]) => [key, path.slice(path.indexOf('/') + 1)]));
    belowRoot.set(roots, paths);
  }
  return paths;
}
