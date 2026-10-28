/**
 * `%Name` claims over a seated tree, shared by the linter and the render path. The seating records
 * the root's claims (`SeatedPaths.ownership`), and this reduces that table to the path spellings a
 * NodePath walk reads.
 */

import type { RawNode } from '../parser/types.js';
import type { UniqueNameOwnership } from '../parser/nodeOwner.js';
import { sceneSeating } from '../parser/sceneTreeBuilder.js';
import { belowRoot } from './nodePath.js';
import { perObject } from './perObject.js';

/** The root's `%Name` claims in `roots`, keyed with the prefix on. One object per tree. */
export function cachedUniqueNameOwnership(roots: readonly RawNode[]): UniqueNameOwnership {
  return sceneSeating(roots).ownership;
}

/** The same reduction onto `livePath`, for the composed render tree. One object per tree. */
export const cachedUniqueNameLivePaths = perObject(
  (roots: readonly RawNode[]): ReadonlyMap<string, string> =>
    new Map([...cachedUniqueNameOwnership(roots).claims].map(([key, claim]) => [key, claim.livePath]))
);

/**
 * The live paths again, spelt below the root, as an instance of the scene holds them. The root
 * claims nothing (it has no owner), so each path continues below it. One object per tree.
 */
export const cachedUniqueNamesBelowRoot = perObject(
  (roots: readonly RawNode[]): ReadonlyMap<string, string> =>
    new Map([...cachedUniqueNameLivePaths(roots)].map(([key, path]) => [key, belowRoot(path)]))
);
