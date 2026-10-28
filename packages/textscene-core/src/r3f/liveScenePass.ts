/**
 * The live stage of the scene passes (ADR-0060): a pass that reads the whole Live scene tree, so a
 * node it names binds across an instance border, and answers per live node path. A sub-scene's
 * nodes are shared by every instance of it, so a result is keyed by the path, never written into a node.
 */

import { useMemo } from 'react';
import { liveTreeOf, type LiveTree } from './liveSceneTree.js';
import { useLiveTreeSelection, type SharedLiveTree } from './useLiveSceneTree.js';
import { perObject } from '../utils/perObject.js';

/** A pass over one live tree, with a result for each live node path it binds. */
export type LiveScenePass<Result> = (tree: LiveTree) => ReadonlyMap<string, Result>;

/** Written only by {@link liveScenePassResults}: each pass runs once for each live tree. */
const resultsByPass = perObject((pass: LiveScenePass<unknown>) => perObject((tree: LiveTree) => pass(tree)));

/** What `pass` binds in `tree`, run once however many readers ask. */
function liveScenePassResults<Result>(
  pass: LiveScenePass<Result>,
  tree: LiveTree
): ReadonlyMap<string, Result> {
  return resultsByPass(pass)(tree) as ReadonlyMap<string, Result>;
}

/**
 * What `pass` binds at the live path `path` of the shared live tree, or undefined. A null path
 * watches no load. A load runs the pass again, and the reader re-renders only where its own result
 * changed identity, so `pass` and a result it keeps for an unchanged input must be stable.
 */
export function useLiveScenePass<Result>(
  pass: LiveScenePass<Result>,
  path: string | null
): Result | undefined {
  const select = useMemo(
    () =>
      path === null
        ? null
        : (live: SharedLiveTree) => liveScenePassResults(pass, liveTreeOf(live.roots, live.ctx)).get(path),
    [pass, path]
  );
  return useLiveTreeSelection(select, Object.is);
}
