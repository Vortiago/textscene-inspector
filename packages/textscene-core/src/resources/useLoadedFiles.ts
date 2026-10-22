/**
 * Files a hook loads by path through the resource loader, for a caller that reads any number of
 * them: a builder that resolves an ExtResource, or a CSG root whose subtree reads many `.tres`.
 */

import { useEffect, useMemo, useRef } from 'react';
import type { ParsedResource } from '../parser/parsedResource';
import type { ResourceLoader } from './ResourceLoader';
import type { ResourceType } from './ResourceEventBus';
import { useMissingResources } from '../r3f/contexts/MissingResourcesContext';
import type { LoadedFile } from './scopedResource';
import { useCacheVersion } from './useCacheVersion';
import { usePendingWhile } from './usePendingWhile';
import { useResourceLoader } from './useResource';

export interface LoadedFiles {
  /** The parse of a file the plan named, or undefined while it loads or after it failed. */
  loadedFile: LoadedFile;
  /** True while a file the plan names has neither loaded nor failed. */
  isLoading: boolean;
}

/** A file's cache entry: undefined while it loads, null once it has failed. */
type CachedFile = ParsedResource | null | undefined;

/** A mesh `.tres` loads on the generic resource bus. */
const RESOURCE_BUS: readonly ResourceType[] = ['resource'];
const NO_PATHS: ReadonlySet<string> = new Set();

/**
 * The files a plan names, as the resource loader's cache holds them: a hook cannot run once per
 * file, and a plan may name any number. The plan reads the cache itself, so a file it names only
 * once another has loaded joins the list as that one arrives. Each file is requested and pinned
 * while the caller is mounted, and a file that fails shows as a **Missing resource**. A caller
 * keeps `plan` stable while its inputs hold.
 */
export function useLoadedFiles(plan: (loadedFile: LoadedFile) => readonly string[]): LoadedFiles {
  const loader = useResourceLoader();
  const readPaths = useRef<ReadonlySet<string>>(NO_PATHS);
  const version = useCacheVersion(loader, RESOURCE_BUS, readPaths);
  const paths = useStableList(
    // `version` is a cache-buster: the cache changes outside React.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useMemo(() => plan((path) => cachedFile(loader, path) ?? undefined), [plan, loader, version])
  );
  useEffect(() => {
    readPaths.current = new Set(paths);
  }, [paths]);
  useRequestedFiles(loader, paths);

  const read = useMemo(
    () => new Map(paths.map((path) => [path, cachedFile(loader, path)] as const)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [loader, paths, version]
  );
  const files = useStableEntries(read);
  useMissingFiles(files);

  const loadedFile = useMemo((): LoadedFile => (path) => files.get(path) ?? undefined, [files]);
  const isLoading = loader !== null && [...files.values()].some((file) => file === undefined);
  usePendingWhile(isLoading);
  return useMemo(() => ({ loadedFile, isLoading }), [loadedFile, isLoading]);
}

function cachedFile(loader: ResourceLoader | null, path: string): CachedFile {
  return loader?.resources.getCached(path);
}

/**
 * `files` under the identity of the last map with the same entries. `version` moves on every
 * resource load in the project, and a new map would rebuild the root's plan and its subtree.
 */
function useStableEntries(files: ReadonlyMap<string, CachedFile>): ReadonlyMap<string, CachedFile> {
  const last = useRef(files);
  const stable = sameEntries(last.current, files) ? last.current : files;
  useEffect(() => {
    last.current = stable;
  }, [stable]);
  return stable;
}

function sameEntries(a: ReadonlyMap<string, CachedFile>, b: ReadonlyMap<string, CachedFile>): boolean {
  if (a.size !== b.size) return false;
  for (const [path, file] of b) {
    if (!a.has(path) || a.get(path) !== file) return false;
  }
  return true;
}

/** Requests each file not yet cached, and pins each so LRU eviction spares it while mounted. */
function useRequestedFiles(loader: ResourceLoader | null, paths: readonly string[]): void {
  useEffect(() => {
    if (!loader) return undefined;
    for (const path of paths) {
      loader.resources.pin(path);
      if (loader.resources.getCached(path) === undefined) loader.resources.request(path);
    }
    return () => paths.forEach((path) => loader.resources.unpin(path));
  }, [loader, paths]);
}

/**
 * Reports each failed file as a **Missing resource** while it stays failed. A file this hook
 * reported that loads later was uploaded, so its row stays, marked uploaded, as `useMissingReport`
 * keeps it for one file.
 */
function useMissingFiles(files: ReadonlyMap<string, CachedFile>): void {
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
