/**
 * The host for code with no hooks: snapshots over the loader's caches, the first adapter of the
 * inner seam. A snapshot answers each file once, so a run sees one consistent view, and records
 * each file it asked for, a miss included: a parsed resource file, or the value of a processor.
 */

import type { ParsedResource } from '../../parser/parsedResource';
import { answeredOnce, recordingReads, type CacheSource } from '../../r3f/cacheSources';
import type { ResourceProcessor } from '../createResourceProcessor';
import { FILE_KIND_BUSES, PARSED_RESOURCES, type FileKind } from '../fileKinds';
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
  /**
   * Each file the current snapshot read, and each `file::id` address it found in a loaded file, with
   * its answer, for the host's **Missing resource** report. An address the file does not declare answers null.
   */
  files(): ReadonlyMap<string, CachedFile<object>>;
}

/** One kind of file the snapshots read: its cache, kept while a file reloads, and what the current snapshot read. */
interface KindReads {
  readonly cache: ResourceProcessor<object>;
  readonly settled: CacheSource<object>;
  /** Written only by the snapshot's recording. A new snapshot starts it empty. */
  reads: Map<string, CachedFile<object>>;
  /** Written only by `request` and the last unsubscribe: the files this source holds pinned. */
  readonly pinned: Set<string>;
}

export function loaderSnapshots(loader: ResourceLoader): SnapshotSource {
  /** Written only by `kindReads`: each kind of file a snapshot of this source has read. */
  const kinds = new Map<FileKind<object>, KindReads>();
  const kindReads = (fileKind: FileKind<object>): KindReads => {
    let found = kinds.get(fileKind);
    if (!found) {
      const cache = fileKind.cacheOf(loader);
      found = { cache, settled: keptWhileReloading(cache), reads: new Map(), pinned: new Set() };
      kinds.set(fileKind, found);
    }
    return found;
  };
  const parsed = kindReads(PARSED_RESOURCES);
  /** Written only by the snapshot's address listener. A new snapshot starts it empty. */
  let addresses = new Map<string, ParsedResource | null>();
  let listeners = 0;

  const start = (): ResourceSnapshot => {
    kinds.forEach((kind) => (kind.reads = new Map()));
    addresses = new Map();
    const found = addresses;
    const recordedIn = (kind: KindReads) => {
      const recorded = kind.reads;
      return recordingReads(answeredOnce(kind.settled), (path, answer) => recorded.set(path, answer));
    };
    const parsedFiles = recordedIn(parsed) as CacheSource<ParsedResource>;
    /** Written only by `loaded`: the recording reader of each kind, for this snapshot. */
    const loadedFiles = new Map<FileKind<object>, CacheSource<object>>();
    return snapshotOver({
      ...parsedFiles,
      loaded(fileKind, address) {
        let files = loadedFiles.get(fileKind);
        if (!files) loadedFiles.set(fileKind, (files = recordedIn(kindReads(fileKind))));
        return files.getCached(address);
      },
      onAddress: (address, file) => found.set(address, file),
    });
  };
  let snapshot = start();
  const isStale = () => {
    for (const { reads, settled } of kinds.values()) {
      for (const [path, answer] of reads) if (settled.getCached(path) !== answer) return true;
    }
    return false;
  };

  return {
    current() {
      if (isStale()) snapshot = start();
      return snapshot;
    },
    request() {
      kinds.forEach(requestReads);
    },
    subscribe(onStale) {
      listeners++;
      const unsubscribe = loader.eventBus.onChange(FILE_KIND_BUSES, ({ busType, event, key }) => {
        for (const [fileKind, { cache, reads }] of kinds) {
          if (!fileKind.busTypes.includes(busType) || !reads.has(key)) continue;
          // A reload keeps the last answer up until the file settles again.
          if (event === 'invalidated') cache.request(key);
          else onStale();
        }
      });
      return () => {
        unsubscribe();
        if (--listeners > 0) return;
        kinds.forEach(({ cache, pinned }) => {
          pinned.forEach((path) => cache.unpin(path));
          pinned.clear();
        });
      };
    },
    files() {
      const files = new Map<string, CachedFile<object>>();
      kinds.forEach(({ reads }) => reads.forEach((answer, path) => files.set(path, answer)));
      addresses.forEach((answer, address) => files.set(address, answer));
      return files;
    },
  };
}

/** Requests and pins each file `kind` read, and unpins each it no longer reads. */
function requestReads({ cache, reads, pinned }: KindReads): void {
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
}

/**
 * `cache`, answering a file that reloads with its last settled answer, as `useResource` keeps the
 * old value on screen while a key reloads.
 */
function keptWhileReloading<T extends object>(cache: ResourceProcessor<T>): CacheSource<T> {
  /** Written only by `getCached`: the last answer of each path that has settled. */
  const last = new Map<string, T | null>();
  return {
    getCached(path) {
      const answer = cache.getCached(path);
      if (answer !== undefined) last.set(path, answer);
      return answer === undefined ? last.get(path) : answer;
    },
  };
}
