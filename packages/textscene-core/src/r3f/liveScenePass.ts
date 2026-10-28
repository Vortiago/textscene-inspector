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
export function liveScenePassResults<Result>(
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
    () => (path === null ? null : (results: ReadonlyMap<string, Result>) => results.get(path)),
    [path]
  );
  return useLiveScenePassSelection(pass, select, Object.is);
}

/**
 * A value `select` reads from everything `pass` binds in the shared live tree, undefined with no
 * tree. The reader re-renders only where `isSame` says a load changed the value. A null `select` asks
 * nothing, so it watches no load. `pass`, `select` and `isSame` must be stable.
 */
export function useLiveScenePassSelection<Result, T>(
  pass: LiveScenePass<Result>,
  select: ((results: ReadonlyMap<string, Result>) => T) | null,
  isSame: (a: T, b: T) => boolean
): T | undefined {
  const selectFromTree = useMemo(
    () =>
      select === null
        ? null
        : (live: SharedLiveTree) => select(liveScenePassResults(pass, liveTreeOf(live.roots, live.ctx))),
    [pass, select]
  );
  return useLiveTreeSelection(selectFromTree, isSame);
}
