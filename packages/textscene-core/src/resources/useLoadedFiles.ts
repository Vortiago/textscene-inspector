/**
 * Files a hook loads by path through the resource loader, for a caller that reads any number of
 * them: a builder that resolves an ExtResource, or a CSG root whose subtree reads many `.tres`.
 * A kind of resource has its own cache and bus, so `useCachedFiles` serves them all.
 */

import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import type { ParsedResource } from '../parser/parsedResource';
import type { ResourceLoader } from './ResourceLoader';
import type { ResourceProcessor } from './createResourceProcessor';
import type { ResourceType } from './ResourceEventBus';
import { useMissingResources } from '../r3f/contexts/MissingResourcesContext';
import type { LoadedFile } from './scopedResource';
import { useCacheVersion } from './useCacheVersion';
import { usePendingWhile } from './usePendingWhile';
import { useResourceLoader } from './useResource';
import { sameEntries } from '../utils/sameEntries';

/** A file's value once loaded, or undefined while it loads and after it failed. */
export type CachedFileReader<T> = (path: string) => T | undefined;

export interface CachedFiles<T> {
  /** The value of a file the plan named, or undefined while it loads or after it failed. */
  loadedFile: CachedFileReader<T>;
  /** True while a file the plan names has neither loaded nor failed. */
  isLoading: boolean;
}

export type LoadedFiles = CachedFiles<ParsedResource>;

/** A file's cache entry: undefined while it loads, null once it has failed. */
type CachedFile<T> = T | null | undefined;

/** The cache and the bus events of one kind of file, which a hook of this module reads. */
export interface FileKind<T extends object> {
  busTypes: readonly ResourceType[];
  cacheOf: (loader: ResourceLoader) => ResourceProcessor<T>;
}

/** A mesh `.tres` loads on the generic resource bus. */
const PARSED_RESOURCES: FileKind<ParsedResource> = {
  busTypes: ['resource'],
  cacheOf: (loader) => loader.resources,
};

const NO_PATHS: ReadonlySet<string> = new Set();

/**
 * The files a plan names, as the resource loader's cache holds them: a hook cannot run once per
 * file, and a plan may name any number, in any order, with repeats. The plan reads the cache itself,
 * so a file it names only once another has loaded joins the list as that one arrives. Each file is
 * requested and pinned while the caller is mounted, and a file that fails shows as a **Missing
 * resource**. Only a load of a file the plan named re-runs the plan. A caller keeps `plan` stable
 * while its inputs hold.
 */
export function useLoadedFiles(plan: (loadedFile: LoadedFile) => readonly string[]): LoadedFiles {
  return useCachedFiles(PARSED_RESOURCES, plan);
}

/** {@link useLoadedFiles} for the files of `kind`. */
export function useCachedFiles<T extends object>(
  kind: FileKind<T>,
  plan: (loadedFile: CachedFileReader<T>) => readonly string[]
): CachedFiles<T> {
  const loader = useResourceLoader();
  const readPaths = useRef<ReadonlySet<string>>(NO_PATHS);
  const version = useCacheVersion(loader, kind.busTypes, readPaths, { onlyReadKeys: true });
  const planned = useMemo(
    () => [...new Set(plan((path) => cachedFile(kind, loader, path) ?? undefined))],
    // `version` is a cache-buster: the cache changes outside React.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [plan, kind, loader, version]
  );
  const paths = useStableList(planned);
  // A layout effect, not `useEffect`: a load that lands between the render and a later passive
  // effect would miss `readPaths`, and `onlyReadKeys` would leave the file loading for good.
  useLayoutEffect(() => {
    readPaths.current = new Set(paths);
  }, [paths]);
  useRequestedFiles(kind, loader, paths);

  const read = useMemo(
    () => new Map(paths.map((path) => [path, cachedFile(kind, loader, path)] as const)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [kind, loader, paths, version]
  );
  const files = useStableEntries(read);
  useMissingFiles(files);

  const loadedFile = useMemo((): CachedFileReader<T> => (path) => files.get(path) ?? undefined, [files]);
  const isLoading = useMemo(() => loader !== null && hasUnsettledFile(files), [loader, files]);
  usePendingWhile(isLoading);
  return { loadedFile, isLoading };
}

function hasUnsettledFile(files: ReadonlyMap<string, CachedFile<object>>): boolean {
  for (const file of files.values()) if (file === undefined) return true;
  return false;
}

function cachedFile<T extends object>(
  kind: FileKind<T>,
  loader: ResourceLoader | null,
  path: string
): CachedFile<T> {
  return loader ? kind.cacheOf(loader).getCached(path) : undefined;
}

/**
 * `files` under the identity of the last map with the same entries. `version` moves on every
 * resource load in the project, and a new map would rebuild the root's plan and its subtree.
 */
function useStableEntries<T extends object>(
  files: ReadonlyMap<string, CachedFile<T>>
): ReadonlyMap<string, CachedFile<T>> {
  const last = useRef(files);
  const stable = sameEntries(last.current, files) ? last.current : files;
  useEffect(() => {
    last.current = stable;
  }, [stable]);
  return stable;
}

/** Requests each file not yet cached, and pins each so LRU eviction spares it while mounted. */
function useRequestedFiles<T extends object>(
  kind: FileKind<T>,
  loader: ResourceLoader | null,
  paths: readonly string[]
): void {
  useEffect(() => {
    if (!loader) return undefined;
    const cache = kind.cacheOf(loader);
    for (const path of paths) {
      cache.pin(path);
      if (cache.getCached(path) === undefined) cache.request(path);
    }
    return () => paths.forEach((path) => cache.unpin(path));
  }, [kind, loader, paths]);
}

/**
 * Reports each failed file as a **Missing resource** while it stays failed. A file this hook
 * reported that loads later was uploaded, so its row stays, marked uploaded, as `useMissingReport`
 * keeps it for one file.
 */
function useMissingFiles(files: ReadonlyMap<string, CachedFile<object>>): void {
  const { report, clear, markUploaded } = useMissingResources();
  const failed = useStableList([...files].filter(([, file]) => file === null).map(([path]) => path));
  const reported = useRef<ReadonlySet<string>>(NO_PATHS);

  useEffect(() => {
    failed.forEach(report);
    return () => failed.forEach(clear);
  }, [failed, report, clear]);

  useEffect(() => {
    const uploaded = [...reported.current].filter((path) => files.get(path));
    uploaded.forEach(markUploaded);
    // A path that left the list is forgotten, so its next load counts as a first load.
    reported.current = new Set(
      [...reported.current, ...failed].filter((path) => files.has(path) && !uploaded.includes(path))
    );
  }, [files, failed, markUploaded]);
}

/** `list` under one identity while its entries stay the same. A path holds no newline. */
function useStableList(list: readonly string[]): readonly string[] {
  const joined = list.join('\n');
  return useMemo(() => (joined ? joined.split('\n') : []), [joined]);
}
