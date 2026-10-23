/**
 * React hooks over the pure **live scene tree** (`liveSceneTree.ts`). They supply the
 * loader's scene and GLB cache snapshots, and re-render when the tree grows because an
 * instance sub-scene or GLB finishes loading after the parsed SceneGraph was built.
 */
import { useMemo, useSyncExternalStore } from 'react';
import { useOptionalHierarchy } from './contexts/HierarchyContext.js';
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
import type { ResourceType } from '../resources/ResourceEventBus.js';

/** The live-tree roots and the snapshot of the loader's caches they are walked over. */
export interface SharedLiveTree {
  roots: readonly TscnNode[];
  ctx: LiveTreeContext;
}

/**
 * Build the live-tree roots and context from the parsed SceneGraph and the loader
 * cache snapshots. `null` while the root scene is not available.
 */
function liveTreeContext(
  sceneGraph: SceneGraph | null | undefined,
  loader: ResourceLoader | null | undefined
): SharedLiveTree | null {
  // `scenes` is optional-chained too: readers outside the canvas (the toolbar)
  // see whatever the host put in HierarchyContext, which is not always a fully
  // built SceneGraph.
  const root = sceneGraph?.scenes?.get(sceneGraph.rootScene);
  if (!root) return null;
  return {
    roots: root.nodes,
    ctx: {
      externalResources: root.externalResources,
      internalResources: root.internalResources,
      sceneCache: loader?.scenes ?? { getCached: () => undefined },
      glbCache: loader?.glbMeshes,
    },
  };
}

const LIVE_TREE_BUSES: readonly ResourceType[] = ['scene', 'glb'];

/** What {@link useLiveTreeVersion} reads of one loader. */
interface LoadTicks {
  /** Written only by the bus handler and by the last unsubscribe. */
  version: number;
  readonly subscribe: (onChange: () => void) => () => void;
  readonly getVersion: () => number;
}

/** Written only by {@link loadTicksOf}, keyed by the loader. */
const loadTicks = new WeakMap<ResourceLoader, LoadTicks>();

const NO_LOAD_TICKS: LoadTicks = { version: 0, subscribe: () => () => {}, getVersion: () => 0 };

/**
 * The one load counter of a loader, which every reader of its live tree shares. A handler sits on
 * the loader's bus only while a reader is mounted, so loads go unseen before the first subscribe
 * and after the last unsubscribe. The version moves at both, so no reader trusts a tree built then.
 */
function loadTicksOf(loader: ResourceLoader | null | undefined): LoadTicks {
  if (!loader) return NO_LOAD_TICKS;
  let ticks = loadTicks.get(loader);
  if (!ticks) {
    const listeners = new Set<() => void>();
    let stopListening: (() => void) | undefined;
    const created: LoadTicks = {
      version: 0,
      getVersion: () => created.version,
      subscribe: (onChange) => {
        if (listeners.size === 0) created.version++;
        listeners.add(onChange);
        stopListening ??= loader.eventBus.onChange(LIVE_TREE_BUSES, ({ event }) => {
          if (event === 'invalidated') return;
          created.version++;
          for (const listener of listeners) listener();
        });
        return () => {
          listeners.delete(onChange);
          if (listeners.size > 0) return;
          stopListening?.();
          stopListening = undefined;
          created.version++;
        };
      },
    };
    loadTicks.set(loader, created);
    ticks = created;
  }
  return ticks;
}

/**
 * A counter that moves whenever a scene or GLB loads or fails, so a deleted
 * instance leaves the tree. A reader of the whole tree re-derives on it; {@link useLiveTreeSelection}
 * re-renders only where its value changed. The scenes and
 * GLBs it reads are `useResource` consumers' keys, which they request again. It is one
 * number per loader, so two readers on one load tick see the same value.
 */
export function useLiveTreeVersion(loader: ResourceLoader | null | undefined): number {
  const ticks = loadTicksOf(loader);
  return useSyncExternalStore(ticks.subscribe, ticks.getVersion);
}

/** A shared tree and the load tick it was built at. */
interface BuiltTree {
  version: number;
  tree: SharedLiveTree | null;
}

/** Written only by {@link sharedTreeAt}: the tree for a graph and loader. */
const sharedTrees = new WeakMap<SceneGraph, WeakMap<object, BuiltTree>>();

/** The key of a reader with no loader, which a WeakMap cannot take as null. */
const NO_LOADER = {};

/** The one tree every reader of `sceneGraph` over `loader` shares for the load tick `version`. */
function sharedTreeAt(
  sceneGraph: SceneGraph,
  loader: ResourceLoader | null | undefined,
  version: number
): SharedLiveTree | null {
  const byLoader = sharedTrees.get(sceneGraph) ?? new WeakMap();
  sharedTrees.set(sceneGraph, byLoader);
  const known = byLoader.get(loader ?? NO_LOADER);
  if (known?.version === version) return known.tree;
  const tree = liveTreeContext(sceneGraph, loader);
  byLoader.set(loader ?? NO_LOADER, { version, tree });
  return tree;
}

/** The scene graph in context, or null with none, and the loader. */
function useSceneGraphAndLoader() {
  // Optional so viewport-level readers (the preview lighting) work in the
  // empty-canvas and test-renderer cases, where no scene is mounted at all.
  const sceneGraph = useOptionalHierarchy()?.sceneGraph ?? null;
  const loader = useResourceLoader();
  return { sceneGraph, loader };
}

/**
 * The live tree of the scene graph in context, or null with no root scene. Every reader asks for
 * the one the graph, loader and load tick give, so a node collapses once however many ask.
 */
export function useSharedLiveTree(): SharedLiveTree | null {
  const { sceneGraph, loader } = useSceneGraphAndLoader();
  const version = useLiveTreeVersion(loader);
  return useMemo(
    () => (sceneGraph ? sharedTreeAt(sceneGraph, loader, version) : null),
    [sceneGraph, loader, version]
  );
}

function sameSelection<T>(a: T | undefined, b: T | undefined, isSame: (a: T, b: T) => boolean): boolean {
  return a === undefined || b === undefined ? a === b : isSame(a, b);
}

/**
 * A value read from the shared live tree, undefined with no tree. A load tick re-reads it, and the
 * reader re-renders only where `isSame` says the value changed, so a reader whose answer a load
 * leaves alone costs no render. `select` and `isSame` must be stable.
 */
export function useLiveTreeSelection<T>(
  select: (tree: SharedLiveTree) => T | undefined,
  isSame: (a: T, b: T) => boolean
): T | undefined {
  const { sceneGraph, loader } = useSceneGraphAndLoader();
  const ticks = loadTicksOf(loader);
  const getSnapshot = useMemo(() => {
    let known: { version: number; value: T | undefined } | undefined;
    return () => {
      const version = ticks.getVersion();
      if (known?.version === version) return known.value;
      const tree = sceneGraph ? sharedTreeAt(sceneGraph, loader, version) : null;
      const read = tree ? select(tree) : undefined;
      const value = known && sameSelection(known.value, read, isSame) ? known.value : read;
      known = { version, value };
      return value;
    };
  }, [ticks, sceneGraph, loader, select, isSame]);
  return useSyncExternalStore(ticks.subscribe, getSnapshot);
}

/** The live nodes matching `predicate`. Pass a stable `predicate` (module-level or memoised), or the memo recomputes every render. */
export function useLiveSceneNodes(
  predicate: (node: TscnNode) => boolean,
  /** Stable, like `predicate`: return false to skip a node's children. */
  descend?: (node: TscnNode) => boolean
): LiveTreeEntry[] {
  const liveTree = useSharedLiveTree();
  return useMemo(
    () => (liveTree ? collectLiveNodes(liveTree.roots, liveTree.ctx, predicate, descend) : []),
    [liveTree, predicate, descend]
  );
}

/**
 * Is there a live tree to walk? False exactly where `useLiveSceneNodes` returns `[]` for want of a
 * root scene, which a reader that treats "no tree" apart from "no match" needs to tell apart.
 */
export function useHasLiveTree(): boolean {
  return useSharedLiveTree() !== null;
}

/**
 * The live-tree node at `path`: its effective (collapsed) identity (Instance root
 * merge, ADR-0013) and its `instanceRef`, descending into sub-scenes and GLBs.
 * A node inside a sub-scene resolves the moment that sub-scene lands. `null` for an
 * empty path or an unresolvable segment.
 */
export function useLiveNode(path: string | null | undefined): ResolvedLiveNode | null {
  const liveTree = useSharedLiveTree();
  return useMemo(
    () => (path && liveTree ? resolveLiveEntry(path, liveTree.roots, liveTree.ctx) : null),
    [liveTree, path]
  );
}
