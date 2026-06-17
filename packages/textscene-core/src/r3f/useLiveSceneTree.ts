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

export function useLiveSceneNodes(predicate: (node: TscnNode) => boolean): LiveTreeEntry[] {
  const { sceneGraph } = useHierarchy();
  const loader = useResourceLoader();

  // The live tree grows as instance sub-scenes / GLBs finish loading; the loader
  // caches are mutated externally, so a version tick on those events is the
  // reactivity bridge that re-runs the memo below.
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

  return useMemo(() => {
    const root = sceneGraph?.scenes.get(sceneGraph.rootScene);
    if (!root) return [];
    const ctx: LiveTreeContext = {
      externalResources: root.externalResources,
      sceneCache: loader?.scenes ?? { getCached: () => undefined },
      glbCache: loader?.glbMeshes,
    };
    return collectLiveNodes(root.nodes, ctx, predicate);
  }, [sceneGraph, loader, version, predicate]);
}
