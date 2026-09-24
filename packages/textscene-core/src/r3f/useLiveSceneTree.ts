/**
 * React hooks over the pure **live scene tree** (`liveSceneTree.ts`). They supply the
 * loader's scene and GLB cache snapshots, and re-render when the tree grows because an
 * instance sub-scene or GLB finishes loading after the parsed SceneGraph was built.
 */
import { useEffect, useMemo, useState } from 'react';
import { useHierarchy, useOptionalHierarchy } from './contexts/HierarchyContext.js';
import { useResourceLoader } from '../resources/useResource.js';
import {
  collectLiveNodes,
  resolveLiveEntry,
  type LiveTreeContext,
  type LiveTreeEntry,
  type ResolvedLiveNode,
} from './liveSceneTree.js';
import type { TscnNode } from '../parser/types.js';
import type { SceneGraph } from '../core/SceneGraph.js';
import type { ResourceLoader } from '../resources/ResourceLoader.js';

/**
 * Build the live-tree roots and context from the parsed SceneGraph and the loader
 * cache snapshots, for the hooks and for one-shot callers. `null` while the root
 * scene is not available.
 */
export function liveTreeContext(
  sceneGraph: SceneGraph | null | undefined,
  loader: ResourceLoader | null | undefined
): { roots: readonly TscnNode[]; ctx: LiveTreeContext } | null {
  // `scenes` is optional-chained too: readers outside the canvas (the toolbar)
  // see whatever the host put in HierarchyContext, which is not always a fully
  // built SceneGraph.
  const root = sceneGraph?.scenes?.get(sceneGraph.rootScene);
  if (!root) return null;
  return {
    roots: root.nodes,
    ctx: {
      externalResources: root.externalResources,
      sceneCache: loader?.scenes ?? { getCached: () => undefined },
      glbCache: loader?.glbMeshes,
    },
  };
}

/**
 * A counter that increments whenever a scene or GLB finishes loading. The loader
 * caches mutate outside React, so every live-tree reader depends on this tick to
 * re-derive.
 */
export function useLiveTreeVersion(loader: ResourceLoader | null | undefined): number {
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const bus = loader?.eventBus;
    if (!bus) return undefined;
    const bump = () => setVersion((v) => v + 1);
    bus.on('scene', 'loaded', bump);
    bus.on('glb', 'loaded', bump);
    return () => {
      bus.off('scene', 'loaded', bump);
      bus.off('glb', 'loaded', bump);
    };
  }, [loader]);
  return version;
}

/** The live nodes matching `predicate`. Pass a stable `predicate` (module-level or memoised), or the memo recomputes every render. */
export function useLiveSceneNodes(
  predicate: (node: TscnNode) => boolean,
  /** Stable, like `predicate`: return false to skip a node's children. */
  descend?: (node: TscnNode) => boolean
): LiveTreeEntry[] {
  // Optional so viewport-level readers (the preview lighting) work in the
  // empty-canvas and test-renderer cases, where no scene is mounted at all.
  const sceneGraph = useOptionalHierarchy()?.sceneGraph ?? null;
  const loader = useResourceLoader();
  const version = useLiveTreeVersion(loader);

  return useMemo(() => {
    const lt = liveTreeContext(sceneGraph, loader);
    if (!lt) return [];
    return collectLiveNodes(lt.roots, lt.ctx, predicate, descend);
    // `version` is a cache-buster: the callback never reads it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sceneGraph, loader, version, predicate, descend]);
}

/**
 * The live-tree node at `path`: its effective (collapsed) identity (Instance root
 * merge, ADR-0013) and its `instanceRef`, descending into sub-scenes and GLBs.
 * A node inside a sub-scene resolves the moment that sub-scene lands. `null` for an
 * empty path or an unresolvable segment.
 */
export function useLiveNode(path: string | null | undefined): ResolvedLiveNode | null {
  const { sceneGraph } = useHierarchy();
  const loader = useResourceLoader();
  const version = useLiveTreeVersion(loader);

  return useMemo(() => {
    if (!path) return null;
    const lt = liveTreeContext(sceneGraph, loader);
    if (!lt) return null;
    return resolveLiveEntry(path, lt.roots, lt.ctx);
    // `version` is a cache-buster: the callback never reads it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sceneGraph, loader, version, path]);
}
