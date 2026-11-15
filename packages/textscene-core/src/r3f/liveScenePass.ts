/**
 * The live stage of the scene passes (ADR-0060): a pass that reads the whole Live scene tree, so a
 * node it names binds across an instance border, and answers per live node path. A sub-scene's
 * nodes are shared by every instance of it, so a result is keyed by the path, never written into a node.
 * A pass reads a resource file through the snapshot it is handed, which its host requests.
 */

import { useMemo } from 'react';
import type { ResourceSnapshot } from '../resources/reading';
import { answersTheSame, recording, type RecordedRead } from './recordedReads.js';
import { liveTreeOf, type LiveTree } from './liveSceneTree.js';
import { useLiveTreeSelection, type SharedLiveTree } from './useLiveSceneTree.js';
import { perObject } from '../utils/perObject.js';

/** A pass over one live tree, with a result for each live node path it binds. */
export type LiveScenePass<Result> = (
  tree: LiveTree,
  snapshot: ResourceSnapshot
) => ReadonlyMap<string, Result>;

/** What a derivation of a live tree computes from the tree and the resource files it reads. */
export type LiveTreeDerivation<T> = (tree: LiveTree, snapshot: ResourceSnapshot) => T;

interface Kept {
  readonly reads: readonly RecordedRead[];
  readonly value: unknown;
}

/** Written only by {@link liveTreeResult}: the last value of each derivation over each tree. */
const keptByDerivation = perObject((_derive: LiveTreeDerivation<unknown>) => new WeakMap<LiveTree, Kept>());

/**
 * What `derive` computes over `tree`, run once however many readers ask. The value is kept while
 * the tree is the same and each read it made answers the same on `snapshot`, so a load of a file it
 * never read runs nothing and a reader keeps the same object (ADR-0060).
 */
export function liveTreeResult<T>(
  derive: LiveTreeDerivation<T>,
  tree: LiveTree,
  snapshot: ResourceSnapshot
): T {
  const kept = keptByDerivation(derive as LiveTreeDerivation<unknown>);
  const last = kept.get(tree);
  // Re-read through `snapshot`, so a caller that records its own reads records these too.
  if (last && answersTheSame(last.reads, snapshot)) return last.value as T;
  const reads: RecordedRead[] = [];
  const value = derive(tree, recording(snapshot, reads));
  kept.set(tree, { reads, value });
  return value;
}

/** What `pass` binds in `tree`, run once however many readers ask. */
export function liveScenePassResults<Result>(
  pass: LiveScenePass<Result>,
  tree: LiveTree,
  snapshot: ResourceSnapshot
): ReadonlyMap<string, Result> {
  return liveTreeResult(pass, tree, snapshot);
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
        : (live: SharedLiveTree, snapshot: ResourceSnapshot) =>
            select(liveScenePassResults(pass, liveTreeOf(live.roots, live.ctx), snapshot)),
    [pass, select]
  );
  return useLiveTreeSelection(selectFromTree, isSame);
}
