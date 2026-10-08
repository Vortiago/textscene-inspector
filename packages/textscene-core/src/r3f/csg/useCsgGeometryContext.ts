/**
 * The context a CSG root builds its plan's solids against: the scene's pools, and each `.tres` a
 * shape in its plan reads. It reads the loader's cache, because a subtree reads any number of files
 * and a hook cannot run once per file. A node inside an ancestor's plan passes null and takes the
 * root's context from `CsgSubtreeContext`, so only the root loads.
 */

import { useEffect, useMemo, useRef } from 'react';
import type { ParsedResource } from '../../parser/parsedResource';
import type { TscnNode } from '../../parser/types';
import type { ResourceLoader } from '../../resources/ResourceLoader';
import type { ResourceType } from '../../resources/ResourceEventBus';
import { useCacheVersion } from '../../resources/useCacheVersion';
import { usePendingWhile } from '../../resources/usePendingWhile';
import { useResourceLoader } from '../../resources/useResource';
import { useMissingResources } from '../contexts/MissingResourcesContext';
import { nodeComponentRegistry } from '../NodeComponentRegistry';
import { useSceneResources, type SceneResources } from '../SceneResourcesContext';
import type { CsgGeometryContext } from './csgRegistration';

export interface CsgGeometrySetup {
  context: CsgGeometryContext;
  /** True while a file the plan reads has neither loaded nor failed. */
  isLoading: boolean;
}

/** A file's cache entry: undefined while it loads, null once it has failed. */
type CachedFile = ParsedResource | null | undefined;

/** A mesh `.tres` loads on the generic resource bus. */
const RESOURCE_BUS: readonly ResourceType[] = ['resource'];
const NO_PATHS: ReadonlySet<string> = new Set();

export function useCsgGeometryContext(root: TscnNode | null): CsgGeometrySetup {
  const pools = useSceneResources();
  const loader = useResourceLoader();
  const files = useCachedFiles(loader, useSubtreeFiles(root, pools));

  const context = useMemo(
    (): CsgGeometryContext => ({ ...pools, file: (path) => files.get(path) ?? undefined }),
    [pools, files]
  );
  const isLoading = loader !== null && [...files.values()].some((file) => file === undefined);
  usePendingWhile(isLoading);
  return useMemo(() => ({ context, isLoading }), [context, isLoading]);
}

/** Each `.tres` a CSG shape under `root` reads, sorted, and stable while that list is. */
function useSubtreeFiles(root: TscnNode | null, pools: SceneResources): readonly string[] {
  return useStableList(useMemo(() => (root ? subtreeFiles(root, pools) : []), [root, pools]));
}

/** Only CSG children, as only they join the root's boolean (`csgPlan.ts`). */
function subtreeFiles(root: TscnNode, pools: SceneResources): string[] {
  const paths = new Set<string>();
  const visit = (node: TscnNode): void => {
    const shape = nodeComponentRegistry.getCsgShape(node.type);
    if (!shape) return;
    for (const path of shape.readsFiles?.(node.properties as Record<string, unknown>, pools) ?? [])
      paths.add(path);
    node.children.forEach(visit);
  };
  visit(root);
  return [...paths].sort();
}

/** Each path's cache entry, re-read on the loader's events, with each file requested and pinned. */
function useCachedFiles(
  loader: ResourceLoader | null,
  paths: readonly string[]
): ReadonlyMap<string, CachedFile> {
  const readPaths = useRef<ReadonlySet<string>>(NO_PATHS);
  const version = useCacheVersion(loader, RESOURCE_BUS, readPaths);
  useEffect(() => {
    readPaths.current = new Set(paths);
  }, [paths]);
  useRequestedFiles(loader, paths);

  const files = useMemo(
    () => new Map(paths.map((path) => [path, loader?.resources.getCached(path)] as const)),
    // `version` is a cache-buster: the cache changes outside React.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [loader, paths, version]
  );
  useMissingFiles(files);
  return files;
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
    reported.current = new Set([...reported.current, ...failed].filter((path) => !uploaded.includes(path)));
  }, [files, failed, markUploaded]);
}

/** `list` under one identity while its entries stay the same. A path holds no newline. */
function useStableList(list: readonly string[]): readonly string[] {
  const joined = list.join('\n');
  return useMemo(() => (joined ? joined.split('\n') : []), [joined]);
}
