/**
 * The resource files the Live scene tree and its passes read, for one loader: one snapshot source
 * that the tree, every pass and every reader of the tree share, so a file is read once and answers
 * once. A read in render schedules a request in a microtask, since a request inside `getSnapshot`
 * of a store is forbidden and no one effect sees every reader's reads.
 */

import type { ResourceLoader } from '../resources/ResourceLoader.js';
import type { ResourceSnapshot } from '../resources/reading';
import type { ParsedResource } from '../parser/parsedResource.js';
import type { CacheSource } from './cacheSources.js';
import { loaderSnapshots, NO_LOADER, type SnapshotSource } from '../resources/reading/loaderSnapshots.js';
import type { CachedFile } from '../resources/useLoadedFiles.js';
import { perObject } from '../utils/perObject.js';
import { subscribeToNothing } from '../utils/subscribeToNothing.js';
import { sameEntries } from '../utils/sameEntries.js';

export interface LiveFiles {
  /** The same snapshot until a file it read loads, fails or reloads. Each read on it is requested. */
  current(): ResourceSnapshot;
  /** The parsed resource files as {@link current} reads them, for a walk of a file's text. Each read is requested. */
  parsedFiles(): CacheSource<ParsedResource>;
  /**
   * `onStale` hears a load, a failure or a reload of a file the current snapshot read, and each new
   * snapshot {@link releaseReads} starts. Pins while heard.
   */
  subscribe(onStale: () => void): () => void;
  /** A microtask starts a new snapshot, so a file no reader reads leaves the pending work and the pins. */
  releaseReads(): void;
  /** Each file the current snapshot read, with its answer, for the pending work. */
  files(): ReadonlyMap<string, CachedFile<object>>;
  /** `onChange` hears each change of {@link files}, and each load or failure of a read file. */
  subscribeFiles(onChange: () => void): () => void;
  /** A number that moves whenever `files()` may have changed. */
  filesVersion(): number;
}

/** Every read answers a failed file: no loader holds anything. */
export const NO_LIVE_FILES: LiveFiles = {
  current: NO_LOADER.current,
  parsedFiles: NO_LOADER.parsedFiles,
  subscribe: subscribeToNothing,
  releaseReads: () => {},
  files: NO_LOADER.files,
  subscribeFiles: subscribeToNothing,
  filesVersion: () => 0,
};

/** The one {@link LiveFiles} of each loader. */
const liveFilesOfLoader = perObject((loader: ResourceLoader): LiveFiles =>
  liveFilesOver(loaderSnapshots(loader))
);

/** The live files of `loader`, or {@link NO_LIVE_FILES} with no loader. */
export function liveFilesOf(loader: ResourceLoader | null | undefined): LiveFiles {
  return loader ? liveFilesOfLoader(loader) : NO_LIVE_FILES;
}

/** The live files over `source`. */
function liveFilesOver(source: SnapshotSource): LiveFiles {
  const fileListeners = new Set<() => void>();
  const staleListeners = new Set<() => void>();
  /** Written only by `filesChanged` and the source listener of `subscribeFiles`. */
  let version = 0;
  /**
   * Written only by `freshSnapshot` and the stale handlers: whether `last` is still the source's
   * current snapshot. Only a heard stale event can end it, so it holds only while a reader listens.
   */
  let isFresh = false;
  let last = source.current();
  let lastParsed = source.parsedFiles();
  const freshSnapshot = () => {
    if (isFresh) return last;
    last = source.current();
    lastParsed = source.parsedFiles();
    isFresh = staleListeners.size > 0;
    return last;
  };
  const hearStale = (onStale: () => void) =>
    source.subscribe(() => {
      isFresh = false;
      onStale();
    });
  /** Written only by `scheduleRequest` and the microtask it queues. */
  let isRequestQueued = false;
  /** Written only by the microtask `scheduleRequest` queues: the files the listeners last heard of. */
  let reported: ReadonlyMap<string, CachedFile<object>> = new Map();
  /** Written only by `releaseReads` and the microtask it queues. */
  let isRestartQueued = false;
  const filesChanged = () => {
    version++;
    for (const listener of fileListeners) listener();
  };
  const scheduleRequest = () => {
    if (isRequestQueued) return;
    isRequestQueued = true;
    queueMicrotask(() => {
      isRequestQueued = false;
      source.request();
      // A kept pass re-reads on each run, so most requests read no new file and need no report.
      const files = source.files();
      if (sameEntries(reported, files)) return;
      reported = files;
      filesChanged();
    });
  };
  /** Written only here: each snapshot of the source, with each read on it scheduling a request. */
  const requesting = perObject((snapshot: ResourceSnapshot): ResourceSnapshot => ({
    read(reference, kind) {
      scheduleRequest();
      return snapshot.read(reference, kind);
    },
    loaded(fileKind, address) {
      scheduleRequest();
      return snapshot.loaded(fileKind, address);
    },
  }));
  /** Written only here: each parsed-file reader of the source, with each read scheduling a request. */
  const requestingParsed = perObject((files: CacheSource<ParsedResource>): CacheSource<ParsedResource> => ({
    getCached(path) {
      scheduleRequest();
      return files.getCached(path);
    },
  }));
  return {
    current: () => requesting(freshSnapshot()),
    parsedFiles() {
      freshSnapshot();
      return requestingParsed(lastParsed);
    },
    subscribe(onStale) {
      staleListeners.add(onStale);
      const stopHearing = hearStale(onStale);
      return () => {
        staleListeners.delete(onStale);
        if (staleListeners.size === 0) isFresh = false;
        stopHearing();
      };
    },
    releaseReads() {
      if (isRestartQueued) return;
      isRestartQueued = true;
      queueMicrotask(() => {
        isRestartQueued = false;
        source.restart();
        isFresh = false;
        for (const listener of staleListeners) listener();
        scheduleRequest();
      });
    },
    files: () => source.files(),
    subscribeFiles(onChange) {
      fileListeners.add(onChange);
      const stopHearing = hearStale(() => {
        version++;
        onChange();
      });
      return () => {
        fileListeners.delete(onChange);
        stopHearing();
      };
    },
    filesVersion: () => version,
  };
}
