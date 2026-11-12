/**
 * The host for code with no hooks: snapshots over the loader's cache of resource files, the first
 * adapter of the inner seam. A snapshot answers each file once, so a run sees one consistent view,
 * and records each file it asked for, a miss included.
 */

import type { ParsedResource } from '../../parser/parsedResource';
import { answeredOnce, recordingReads, type CacheSource } from '../../r3f/cacheSources';
import type { ResourceProcessor } from '../createResourceProcessor';
import type { CachedFile } from '../useLoadedFiles';
import type { ResourceLoader } from '../ResourceLoader';
import type { ResourceSnapshot } from './read';
import { snapshotOver } from './snapshot';

export interface SnapshotSource {
  /** The same snapshot until a read it recorded would answer differently. */
  current(): ResourceSnapshot;
  /** Requests and pins each file the current snapshot read. Call it after commit, never in render. */
  request(): void;
  /** `onStale` hears a load, a failure or a reload of a file the current snapshot read. */
  subscribe(onStale: () => void): () => void;
  /** Each file the current snapshot read, with its answer, for the host's **Missing resource** report. */
  files(): ReadonlyMap<string, CachedFile<ParsedResource>>;
}

export function loaderSnapshots(loader: ResourceLoader): SnapshotSource {
  const cache = loader.resources;
  const settled = keptWhileReloading(cache);
  /** Written only by the snapshot's recording. A new snapshot starts it empty. */
  let reads = new Map<string, CachedFile<ParsedResource>>();
  /** Written only by `request` and the last unsubscribe: the files this source holds pinned. */
  const pinned = new Set<string>();
  let listeners = 0;

  const start = (): ResourceSnapshot => {
    reads = new Map();
    const recorded = reads;
    return snapshotOver(recordingReads(answeredOnce(settled), (path, answer) => recorded.set(path, answer)));
  };
  let snapshot = start();
  const isStale = () => {
    for (const [path, answer] of reads) if (settled.getCached(path) !== answer) return true;
    return false;
  };

  return {
    current() {
      if (isStale()) snapshot = start();
      return snapshot;
    },
    request() {
      for (const path of reads.keys()) {
        if (!pinned.has(path)) cache.pin(path);
        pinned.add(path);
        if (cache.getCached(path) === undefined && !cache.isLoading(path)) cache.request(path);
      }
      for (const path of pinned) {
        if (reads.has(path)) continue;
        cache.unpin(path);
        pinned.delete(path);
      }
    },
    subscribe(onStale) {
      listeners++;
      const unsubscribe = loader.eventBus.onChange(['resource'], ({ event, key }) => {
        if (!reads.has(key)) return;
        // A reload keeps the last answer up until the file settles again.
        if (event === 'invalidated') cache.request(key);
        else onStale();
      });
      return () => {
        unsubscribe();
        if (--listeners > 0) return;
        pinned.forEach((path) => cache.unpin(path));
        pinned.clear();
      };
    },
    files: () => reads,
  };
}

/**
 * `cache`, answering a file that reloads with its last settled answer, as `useResource` keeps the
 * old value on screen while a key reloads.
 */
function keptWhileReloading(cache: ResourceProcessor<ParsedResource>): CacheSource<ParsedResource> {
  /** Written only by `getCached`: the last answer of each path that has settled. */
  const last = new Map<string, ParsedResource | null>();
  return {
    getCached(path) {
      const answer = cache.getCached(path);
      if (answer !== undefined) last.set(path, answer);
      return answer === undefined ? last.get(path) : answer;
    },
  };
}
