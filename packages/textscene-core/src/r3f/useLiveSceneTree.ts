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
  // Optional so viewport-level readers (the preview lighting) work in the
  // empty-canvas and test-renderer cases, where no scene is mounted at all.
  const sceneGraph = useOptionalHierarchy()?.sceneGraph ?? null;
  const loader = useResourceLoader();
  const version = useLiveTreeVersion(loader);

  return useMemo(() => {
    const lt = liveTreeContext(sceneGraph, loader);
    if (!lt) return [];
    return collectLiveNodes(lt.roots, lt.ctx, predicate);
    // `version` is an intentional cache-buster: it increments each time a
    // sub-scene or GLB finishes loading so the live-node list re-derives.
    // The value itself is not read inside the callback.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sceneGraph, loader, version, predicate]);
}

/**
 * The single live-tree node at `path` — its EFFECTIVE (collapsed) identity
 * (Instance root merge, ADR-0013) plus its originating `instanceRef`, descending
 * into instanced sub-scenes and GLB internals via the loader's cache snapshots.
 * The single-node sibling of `useLiveSceneNodes`, for the inspector. Re-derives
 * on the version tick, so a node selected inside a not-yet-loaded sub-scene
 * resolves the moment that sub-scene lands instead of sticking on the
 * placeholder. Returns `null` for a null/empty path or any unresolvable segment.
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
    // `version` is an intentional cache-buster: it increments each time a
    // resource finishes loading so a node inside an unresolved sub-scene
    // re-derives the moment that sub-scene lands.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sceneGraph, loader, version, path]);
}
