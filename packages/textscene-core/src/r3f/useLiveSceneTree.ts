/**
 * `useLiveSceneNodes` — the React reactive adapter over the pure
 * **live scene tree** (`liveSceneTree.ts`).
 *
 * The core walk is pure over a cache snapshot; this hook supplies the two things
 * React consumers need: the loader's cache snapshots (scene + GLB), and a
 * re-render when the live tree GROWS — i.e. when an instance sub-scene or GLB
 * finishes loading after the parsed SceneGraph was built. Panels (cameras, stats,
 * future search/outline) call this instead of each re-deriving the context and
 * re-subscribing to the resource event bus.
 *
 * Pass a STABLE `predicate` (module-level or memoized) so the memo doesn't
 * recompute every render.
 */
import { useEffect, useMemo, useState } from 'react';
import { useHierarchy } from './contexts/HierarchyContext.js';
import { useResourceLoader } from '../resources/useResource.js';
import { collectLiveNodes, type LiveTreeContext, type LiveTreeEntry } from './liveSceneTree.js';
import type { TscnNode } from '../parser/types.js';
import type { SceneGraph } from '../core/SceneGraph.js';
import type { ResourceLoader } from '../resources/ResourceLoader.js';

/**
 * Build the live-tree roots + context from the parsed SceneGraph and the loader
 * cache snapshots — the shared bridge both the reactive `useLiveSceneNodes` hook
 * and one-shot callers (e.g. the Cameras panel's 2D framing) use, so the
 * SceneGraph/loader → LiveTreeContext mapping lives in one place. Returns `null`
 * when the root scene isn't available yet.
 */
export function liveTreeContext(
  sceneGraph: SceneGraph | null | undefined,
  loader: ResourceLoader | null | undefined
): { roots: readonly TscnNode[]; ctx: LiveTreeContext } | null {
  const root = sceneGraph?.scenes.get(sceneGraph.rootScene);
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
 * A counter that increments whenever a scene/GLB finishes loading — the
 * reactivity bridge for live-tree reads. The live tree GROWS as instance
 * sub-scenes / GLBs load after the parsed SceneGraph was built, and the loader
 * caches are mutated externally, so consumers depend on this tick to re-derive.
 * Shared by every live-tree React reader (`useLiveSceneNodes`, the workspace
 * auto-select, the scene tree's search/expand).
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

export function useLiveSceneNodes(predicate: (node: TscnNode) => boolean): LiveTreeEntry[] {
  const { sceneGraph } = useHierarchy();
  const loader = useResourceLoader();
  const version = useLiveTreeVersion(loader);

  return useMemo(() => {
    const lt = liveTreeContext(sceneGraph, loader);
    if (!lt) return [];
    return collectLiveNodes(lt.roots, lt.ctx, predicate);
  }, [sceneGraph, loader, version, predicate]);
}
