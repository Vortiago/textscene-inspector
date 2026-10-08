/**
 * The context a CSG subtree builds its solids against: the scene's pools, and each `.tres` a shape
 * in the subtree reads. It reads the loader's cache, as `useTileSetModels` does, because a subtree
 * reads any number of files and a hook cannot run once per file.
 */

import { useEffect, useMemo, useRef } from 'react';
import type { ParsedResource } from '../../parser/parsedResource';
import type { TscnNode } from '../../parser/types';
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
  /** True while a file the subtree reads has neither loaded nor failed. */
  isLoading: boolean;
}

/** A mesh `.tres` loads on the generic resource bus. */
const RESOURCE_BUS: readonly ResourceType[] = ['resource'];
const NO_PATHS: ReadonlySet<string> = new Set();

export function useCsgGeometryContext(root: TscnNode): CsgGeometrySetup {
  const pools = useSceneResources();
  const loader = useResourceLoader();
  const paths = useSubtreeFiles(root, pools);

  const readPaths = useRef<ReadonlySet<string>>(NO_PATHS);
  const version = useCacheVersion(loader, RESOURCE_BUS, readPaths);
  useEffect(() => {
    readPaths.current = new Set(paths);
  }, [paths]);
  useRequestedFiles(paths);

  const files = useMemo(
    () => new Map(paths.map((path) => [path, loader?.resources.getCached(path)] as const)),
    // `version` is a cache-buster: the cache changes outside React.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [loader, paths, version]
  );
  const context = useMemo(
    (): CsgGeometryContext => ({ ...pools, file: (path) => files.get(path) ?? undefined }),
    [pools, files]
  );
  const isLoading = loader !== null && [...files.values()].some((file) => file === undefined);
  usePendingWhile(isLoading);
  useMissingFiles(files);
  return { context, isLoading };
}

/** Each `.tres` a CSG shape under `root` reads, sorted, and stable while that list is. */
function useSubtreeFiles(root: TscnNode, pools: SceneResources): readonly string[] {
  const joined = useMemo(() => subtreeFiles(root, pools).join('\n'), [root, pools]);
  return useMemo(() => (joined ? joined.split('\n') : []), [joined]);
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

/** Requests each file not yet cached, and pins each so LRU eviction spares it while mounted. */
function useRequestedFiles(paths: readonly string[]): void {
  const loader = useResourceLoader();
  useEffect(() => {
    if (!loader) return undefined;
    for (const path of paths) {
      loader.resources.pin(path);
      if (loader.resources.getCached(path) === undefined) loader.resources.request(path);
    }
    return () => paths.forEach((path) => loader.resources.unpin(path));
  }, [loader, paths]);
}

/** Reports each file that failed as a **Missing resource**, while it stays failed. */
function useMissingFiles(files: ReadonlyMap<string, ParsedResource | null | undefined>): void {
  const { report, clear } = useMissingResources();
  const failed = [...files].filter(([, file]) => file === null).map(([path]) => path);
  const failedKey = failed.join('\n');
  useEffect(() => {
    const paths = failedKey ? failedKey.split('\n') : [];
    paths.forEach(report);
    return () => paths.forEach(clear);
  }, [failedKey, report, clear]);
}
