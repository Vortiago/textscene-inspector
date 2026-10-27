/**
 * React hooks over the pure **live scene tree** (`liveSceneTree.ts`). They supply the
 * loader's scene and GLB cache snapshots, and re-render when the tree grows because an
 * instance sub-scene or GLB finishes loading after the parsed SceneGraph was built.
 */
import { useCallback, useMemo, useSyncExternalStore } from 'react';
import { useOptionalHierarchy } from './contexts/HierarchyContext.js';
import { useResourceLoader } from '../resources/useResource.js';
import {
  collectLiveNodes,
  liveTreeOf,
  resolveLiveEntry,
  type LiveStep,
  type LiveTree,
  type LiveTreeContext,
  type LiveTreeEntry,
  type ResolvedLiveNode,
} from './liveSceneTree.js';
import type { SceneScope, TscnNode } from '../parser/types.js';
import { liveInstancePath, type LiveNode } from '../resources/liveNode.js';
import { glbPathOf } from '../resources/glbSceneRoot.js';
import type { SceneGraph } from '../core/SceneGraph.js';
import type { ResourceLoader } from '../resources/ResourceLoader.js';
import type { ResourceType } from '../resources/ResourceEventBus.js';
import { perObject } from '../utils/perObject.js';
import { sameElements } from '../utils/sameElements.js';
import { subscribeToNothing } from '../utils/subscribeToNothing.js';
import { NOTHING_CACHED } from './cacheSources.js';

/** The live-tree roots and the snapshot of the loader's caches they are walked over. */
export interface SharedLiveTree {
  roots: readonly TscnNode[];
  ctx: LiveTreeContext;
}

/** The caches of `loader` that a live-tree context reads. With no loader, every path reads as never requested. */
function loaderCaches(loader: ResourceLoader | null | undefined) {
  return { sceneCache: loader?.scenes ?? NOTHING_CACHED, glbCache: loader?.glbMeshes };
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
      ...loaderCaches(loader),
    },
  };
}

const LIVE_TREE_BUSES: readonly ResourceType[] = ['scene', 'glb'];

/** What {@link useLiveTreeVersion} reads of one loader. */
interface LoadTicks {
  /** Written only by the bus handler, the first subscribe and the last unsubscribe. */
  version: number;
  readonly subscribe: (onChange: () => void) => () => void;
  readonly getVersion: () => number;
}

const NO_LOAD_TICKS: LoadTicks = { version: 0, subscribe: subscribeToNothing, getVersion: () => 0 };

/**
 * The one load counter of a loader, which every reader of its live tree shares. A handler sits on
 * the loader's bus only while a reader is mounted, so loads go unseen before the first subscribe
 * and after the last unsubscribe. The version moves at both, so no reader trusts a tree built then.
 */
const loadTicksOfLoader = perObject((loader: ResourceLoader): LoadTicks => {
  const listeners = new Set<() => void>();
  let stopListening: (() => void) | undefined;
  const ticks: LoadTicks = {
    version: 0,
    getVersion: () => ticks.version,
    subscribe: (onChange) => {
      if (listeners.size === 0) ticks.version++;
      listeners.add(onChange);
      stopListening ??= loader.eventBus.onChange(LIVE_TREE_BUSES, ({ event }) => {
        if (event === 'invalidated') return;
        ticks.version++;
        for (const listener of listeners) listener();
      });
      return () => {
        listeners.delete(onChange);
        if (listeners.size > 0) return;
        stopListening?.();
        stopListening = undefined;
        ticks.version++;
      };
    },
  };
  return ticks;
});

function loadTicksOf(loader: ResourceLoader | null | undefined): LoadTicks {
  return loader ? loadTicksOfLoader(loader) : NO_LOAD_TICKS;
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
 * A value read at each load tick of `watched`. A load tick re-reads it, and the reader re-renders
 * only where `isSame` says the value changed. A reader that watches no loader reads at tick 0 once.
 * `readAt` and `isSame` must be stable.
 */
function useReadAtLoadTick<T>(
  watched: ResourceLoader | null | undefined,
  readAt: (version: number) => T,
  isSame: (a: T, b: T) => boolean
): T {
  const ticks = loadTicksOf(watched);
  const getSnapshot = useMemo(() => {
    let known: { version: number; value: T } | undefined;
    return () => {
      const version = ticks.getVersion();
      if (known?.version === version) return known.value;
      const read = readAt(version);
      const value = known && isSame(known.value, read) ? known.value : read;
      known = { version, value };
      return value;
    };
  }, [ticks, readAt, isSame]);
  return useSyncExternalStore(ticks.subscribe, getSnapshot);
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
  const readAt = useCallback(
    (version: number) => {
      const tree = sceneGraph ? sharedTreeAt(sceneGraph, loader, version) : null;
      return tree ? select(tree) : undefined;
    },
    [sceneGraph, loader, select]
  );
  const isSameSelection = useCallback(
    (a: T | undefined, b: T | undefined) => sameSelection(a, b, isSame),
    [isSame]
  );
  return useReadAtLoadTick(loader, readAt, isSameSelection);
}

function seatedRootsOf({ roots, ctx }: SharedLiveTree): readonly TscnNode[] {
  return liveTreeOf(roots, ctx).seatedRoots;
}

/**
 * The root nodes of the scene graph in context with the headings their instances hand back seated,
 * undefined with no root scene. Roots with no such heading are the graph's own array. A load re-renders
 * the reader only where it moves a heading.
 *
 * @canonical The root nodes a viewport or a tree row draws
 */
export function useSeatedRoots(): readonly TscnNode[] | undefined {
  return useLiveTreeSelection(seatedRootsOf, sameElements);
}

/** The tree of a loader built for one load tick. */
interface LoaderTree {
  version: number;
  tree: LiveTree;
}

const NO_ROOTS: readonly TscnNode[] = [];

/** Written only by {@link loaderTreeAt}: the tree of each loader for the load tick it was built at. */
const loaderTrees = new WeakMap<object, LoaderTree>();

/**
 * The tree over the caches of `loader` at load tick `version`, with no roots: a question about one
 * node needs only the caches. Every step question of the tick shares it.
 */
function loaderTreeAt(loader: ResourceLoader | null | undefined, version: number): LiveTree {
  const known = loaderTrees.get(loader ?? NO_LOADER);
  if (known?.version === version) return known.tree;
  const tree = liveTreeOf(NO_ROOTS, {
    externalResources: [],
    internalResources: [],
    ...loaderCaches(loader),
  });
  loaderTrees.set(loader ?? NO_LOADER, { version, tree });
  return tree;
}

/**
 * The step of `node` where it sits in `scope`, over the loader's caches. A reader re-renders only for
 * a load that changes its step, since the tree hands the same step back while every answer it read is
 * unchanged. A node that instances nothing reads no cache, so it watches no load. `scope` must be stable.
 *
 * @canonical The step of a node of the Live scene tree in a React reader
 */
export function useLiveStepOf(node: LiveNode, scope: SceneScope): LiveStep {
  const loader = useResourceLoader();
  const readsCaches = liveInstancePath(node, scope) !== null || glbPathOf(node) !== undefined;
  const watched = readsCaches ? loader : null;
  const readAt = useCallback(
    (version: number) => loaderTreeAt(watched, version).stepOf(node, scope),
    [watched, node, scope]
  );
  return useReadAtLoadTick(watched, readAt, Object.is);
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
