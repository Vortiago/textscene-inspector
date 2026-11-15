/**
 * React hooks over the pure **live scene tree** (`liveSceneTree.ts`). They supply the
 * loader's scene, GLB and `.tres` cache snapshots, and re-render when the tree grows because an
 * instance sub-scene or GLB finishes loading after the parsed SceneGraph was built.
 */
import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { useOptionalHierarchy } from './contexts/HierarchyContext.js';
import { useResourceLoader } from '../resources/useResource.js';
import {
  collectLiveNodes,
  liveTreeOf,
  resolveLiveEntry,
  type LiveStep,
  type LiveTreeContext,
  type LiveTreeEntry,
  type ResolvedLiveNode,
} from './liveSceneTree.js';
import type { SceneScope, TscnNode } from '../parser/types.js';
import { liveInstancePath, type LiveNode } from '../resources/liveNode.js';
import { glbPathOf } from '../resources/glbSceneRoot.js';
import { hasSceneTileCells } from './liveSceneTiles.js';
import type { SceneGraph } from '../core/SceneGraph.js';
import type { ResourceLoader } from '../resources/ResourceLoader.js';
import type { ResourceType } from '../resources/ResourceEventBus.js';
import { perObject } from '../utils/perObject.js';
import { sameElements } from '../utils/sameElements.js';
import { subscribeToNothing } from '../utils/subscribeToNothing.js';
import { NOTHING_CACHED, type CacheSource } from './cacheSources.js';
import type { ParsedResource } from '../parser/parsedResource.js';
import { liveFilesOf, NO_LIVE_FILES, type LiveFiles } from './liveFiles.js';
import type { ResourceSnapshot } from '../resources/reading';
import { readsCover, recording, type RecordedRead } from './recordedReads.js';
import { useProjectSettings } from './contexts/ProjectSettingsContext.js';
import { projectTreeSettings, type ProjectTreeSettings } from '../parser/projectSettingsParser.js';
import { useControlLocalTransforms, type ControlLocalTransforms } from './contexts/YSortContext.js';

/** The live-tree roots and the snapshot of the loader's caches they are walked over. */
export interface SharedLiveTree {
  roots: readonly TscnNode[];
  ctx: LiveTreeContext;
}

/**
 * The caches of `loader` that a live-tree context reads. Its parsed resource files go through the
 * live files, which request each one. With no loader, a scene reads as never requested and a
 * resource file as missing, as `useNodeResource` answers.
 */
function loaderCaches(loader: ResourceLoader | null | undefined) {
  return {
    sceneCache: loader?.scenes ?? NOTHING_CACHED,
    glbCache: loader?.glbMeshes,
    parsedFiles: loader ? loadTicksOfLoader(loader).treeFiles : NO_LIVE_FILES.parsedFiles(),
  };
}

/**
 * Build the live-tree roots and context from the parsed SceneGraph, the loader
 * cache snapshots and the project's tree settings. `null` while the root scene is not available.
 */
function liveTreeContext(
  sceneGraph: SceneGraph | null | undefined,
  loader: ResourceLoader | null | undefined,
  project: ProjectTreeSettings
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
      project,
    },
  };
}

/**
 * The buses whose loads change the tree itself. A resource file reaches the tree and its passes
 * through the loader's {@link LiveFiles}, which hears only a file they read.
 */
const LIVE_TREE_BUSES: readonly ResourceType[] = ['scene', 'glb'];

/** What {@link useLiveTreeVersion} reads of one loader. */
interface LoadTicks {
  /** Written only by `subscribe`'s handlers: moves when the tree must be built again. */
  version: number;
  readonly subscribe: (onChange: () => void) => () => void;
  readonly getVersion: () => number;
  readonly files: LiveFiles;
  /** The parsed resource files the tree reads itself, a tile layer's TileSet, each read recorded. */
  readonly treeFiles: CacheSource<ParsedResource>;
}

const NO_LOAD_TICKS: LoadTicks = {
  version: 0,
  subscribe: subscribeToNothing,
  getVersion: () => 0,
  files: NO_LIVE_FILES,
  treeFiles: NO_LIVE_FILES.parsedFiles(),
};

/**
 * The one load counter of a loader, which every reader of its live tree shares. A handler sits on
 * the loader's bus and its live files only while a reader is mounted, so loads go unseen before the
 * first subscribe and after the last unsubscribe. The version moves at the first subscribe when a
 * load settled, a cache cleared or a file the tree read changed meanwhile, so no reader trusts a tree
 * built then. A resource file moves the tree's version only when the tree itself read it: a file only
 * a pass read keeps the tree, so every other pass keeps its result.
 */
const loadTicksOfLoader = perObject((loader: ResourceLoader): LoadTicks => {
  const files = liveFilesOf(loader);
  const listeners = new Set<() => void>();
  let stopListening: (() => void) | undefined;
  // The token of the last time a reader listened: a change after it is a load or a cache clear that went unseen.
  let listenedUntil = loader.eventBus.changeToken();
  /**
   * Written only by `treeFiles` and `newTree`: each resource file the trees of this version read,
   * with the first answer one got. Several trees share a version, and each keeps what it first read.
   */
  let treeReads = new Map<string, ParsedResource | null | undefined>();
  const newTree = () => {
    ticks.version++;
    treeReads = new Map();
  };
  const changed = (isTreeChanged: boolean) => {
    if (isTreeChanged) newTree();
    for (const listener of listeners) listener();
  };
  const isTreeReadChanged = () => {
    const parsed = files.parsedFiles();
    for (const [path, answer] of treeReads) if (parsed.getCached(path) !== answer) return true;
    return false;
  };
  const ticks: LoadTicks = {
    version: 0,
    files,
    treeFiles: {
      getCached(path) {
        const answer = files.parsedFiles().getCached(path);
        if (!treeReads.has(path)) treeReads.set(path, answer);
        return answer;
      },
    },
    getVersion: () => ticks.version,
    subscribe: (onChange) => {
      if (listeners.size === 0) {
        if (loader.eventBus.hasChangedSince(LIVE_TREE_BUSES, listenedUntil) || isTreeReadChanged()) newTree();
      }
      listeners.add(onChange);
      if (!stopListening) {
        const stopBus = loader.eventBus.onChange(LIVE_TREE_BUSES, ({ event }) => {
          if (event !== 'invalidated') changed(true);
        });
        const stopFiles = files.subscribe(() => changed(isTreeReadChanged()));
        stopListening = () => {
          stopBus();
          stopFiles();
        };
      }
      return () => {
        listeners.delete(onChange);
        if (listeners.size > 0) return;
        stopListening?.();
        stopListening = undefined;
        listenedUntil = loader.eventBus.changeToken();
      };
    },
  };
  return ticks;
});

function loadTicksOf(loader: ResourceLoader | null | undefined): LoadTicks {
  return loader ? loadTicksOfLoader(loader) : NO_LOAD_TICKS;
}

/**
 * A counter that moves whenever a scene or GLB file loads or fails, or a resource file the tree
 * itself read changes, so a deleted instance leaves the tree. A reader of the whole tree re-derives on it; {@link useLiveTreeSelection}
 * re-renders only where its value changed. The scenes and
 * GLBs it reads are `useResource` consumers' keys, which they request again. It is one
 * number per loader, so two readers on one load tick see the same value.
 */
export function useLiveTreeVersion(loader: ResourceLoader | null | undefined): number {
  const ticks = loadTicksOf(loader);
  return useSyncExternalStore(ticks.subscribe, ticks.getVersion);
}

const NO_READS: readonly RecordedRead[] = [];

/** The key of a reader with no loader, which a WeakMap cannot take as null. */
const NO_LOADER = {};

/**
 * A reader of the value that `build` makes for a loader. It builds again once the loader's load tick
 * has moved. A reader with no loader builds once, at tick 0.
 */
function valueAtLoadTick<T>(
  build: (loader: ResourceLoader | null | undefined, version: number) => T
): (loader: ResourceLoader | null | undefined, version: number) => T {
  const built = new WeakMap<object, { version: number; value: T }>();
  return (loader, version) => {
    const known = built.get(loader ?? NO_LOADER);
    if (known?.version === version) return known.value;
    const value = build(loader, version);
    built.set(loader ?? NO_LOADER, { version, value });
    return value;
  };
}

/**
 * The one tree every reader of a scene graph and a project's tree settings over a loader shares for
 * a load tick. `projectTreeSettings` hands back one object for equal values, so the key holds.
 */
const sharedTreesOf = perObject((sceneGraph: SceneGraph) =>
  perObject((project: ProjectTreeSettings) =>
    valueAtLoadTick((loader) => liveTreeContext(sceneGraph, loader, project))
  )
);

/** The node types whose pass composes through a Control: a relay and a Skeleton2D. */
const CONTROL_TRANSFORM_READERS: ReadonlySet<string> = new Set(['RemoteTransform2D', 'Skeleton2D']);

/** Whether a pass over `shared` composes through the transform of a Control. */
const readsControlTransforms = perObject((shared: SharedLiveTree): boolean => {
  let reads = false;
  liveTreeOf(shared.roots, shared.ctx).fold(undefined, ({ step }, _inherited, descend) => {
    reads ||= CONTROL_TRANSFORM_READERS.has(step.node.type);
    descend(undefined);
  });
  return reads;
});

/**
 * `shared` over the transforms the Control walk solved. Written only here, one tree for each pair,
 * so a publish that changes nothing keeps the tree and every pass result over it.
 */
const treesOverControlTransforms = perObject((shared: SharedLiveTree) =>
  perObject((controlTransforms: ControlLocalTransforms): SharedLiveTree => ({
    roots: shared.roots,
    ctx: { ...shared.ctx, controlTransforms },
  }))
);

/**
 * The shared tree of what {@link useLiveTreeInputs} read, at the load tick `version`. A tree with no
 * relay or Skeleton2D reads no solved Control, so a solve never gives it a new tree.
 */
function sharedTreeAt(
  { sceneGraph, loader, project, controlTransforms }: LiveTreeInputs & { sceneGraph: SceneGraph },
  version: number
): SharedLiveTree | null {
  const shared = sharedTreesOf(sceneGraph)(project)(loader, version);
  if (!shared || controlTransforms.size === 0 || !readsControlTransforms(shared)) return shared;
  return treesOverControlTransforms(shared)(controlTransforms);
}

/** What a shared live tree is built from. */
interface LiveTreeInputs {
  sceneGraph: SceneGraph | null;
  loader: ResourceLoader | null;
  project: ProjectTreeSettings;
  /** What the Control walk solved. Empty outside the canvas and before the walk has run. */
  controlTransforms: ControlLocalTransforms;
}

/**
 * The project's tree settings, Godot's defaults without a project. Every live tree is made with
 * them (`LiveTreeContext.project`), so a question about the project is asked of the tree.
 */
export function useProjectTreeSettings(): ProjectTreeSettings {
  return projectTreeSettings(useProjectSettings().settings);
}

/** The scene graph in context, or null with none, the loader and the project's tree settings. */
function useLiveTreeInputs(): LiveTreeInputs {
  // Optional so viewport-level readers (the preview lighting) work in the
  // empty-canvas and test-renderer cases, where no scene is mounted at all.
  const sceneGraph = useOptionalHierarchy()?.sceneGraph ?? null;
  const loader = useResourceLoader();
  const project = useProjectTreeSettings();
  const controlTransforms = useControlLocalTransforms();
  return { sceneGraph, loader, project, controlTransforms };
}

/**
 * The live tree of the scene graph in context, or null with no root scene. Every reader asks for
 * the one the graph, loader and load tick give, so a node collapses once however many ask.
 */
export function useSharedLiveTree(): SharedLiveTree | null {
  const { sceneGraph, loader, project, controlTransforms } = useLiveTreeInputs();
  const version = useLiveTreeVersion(loader);
  return useMemo(
    () => (sceneGraph ? sharedTreeAt({ sceneGraph, loader, project, controlTransforms }, version) : null),
    [sceneGraph, project, loader, controlTransforms, version]
  );
}

/**
 * Whether two values that may be undefined are the same: undefined equals only undefined, and two
 * values go to `isSame`.
 *
 * @canonical Compare two values that may be undefined
 */
export function sameSelection<T>(
  a: T | undefined,
  b: T | undefined,
  isSame: (a: T, b: T) => boolean
): boolean {
  return a === undefined || b === undefined ? a === b : isSame(a, b);
}

/**
 * A value read at each change of `watched` a reader may see: a new tree, or a new snapshot of the
 * live files, which a load of a file the tree or a pass read starts. `readAt` gets the tree's version
 * and that snapshot, and the reader re-renders only where `isSame` says the value changed. A reader
 * that watches no loader reads once. `readAt` and `isSame` must be stable.
 */
function useReadAtLoadTick<T>(
  watched: ResourceLoader | null | undefined,
  readAt: (version: number, snapshot: ResourceSnapshot) => T,
  isSame: (a: T, b: T) => boolean
): T {
  const ticks = loadTicksOf(watched);
  /** Written only by `getSnapshot`: the reads of this reader's last read, by whichever `readAt`. */
  const lastReads = useRef<readonly RecordedRead[]>(NO_READS);
  const getSnapshot = useMemo(() => {
    /** Written only by this reader: what it read last, at which tree and snapshot. */
    let last: { version: number; snapshot: ResourceSnapshot; value: T } | undefined;
    return () => {
      const version = ticks.getVersion();
      const snapshot = ticks.files.current();
      if (last?.version === version && last.snapshot === snapshot) return last.value;
      const reads: RecordedRead[] = [];
      const next = readAt(version, recording(snapshot, reads));
      lastReads.current = reads;
      const value = last && isSame(last.value, next) ? last.value : next;
      last = { version, snapshot, value };
      return value;
    };
  }, [ticks, readAt, isSame]);
  useEffect(() => {
    const committedReads = lastReads.current;
    // A file only this reader read stays in the shared snapshot until it restarts. A new `readAt`
    // that reads the same files keeps it, so a new closure over equal inputs restarts nothing.
    return () => {
      const isUnmounted = lastReads.current === committedReads;
      if (isUnmounted ? committedReads.length > 0 : !readsCover(lastReads.current, committedReads))
        ticks.files.releaseReads();
    };
  }, [ticks, readAt]);
  return useSyncExternalStore(ticks.subscribe, getSnapshot);
}

/**
 * A value read from the shared live tree and the resource files it names, undefined with no tree. A
 * load re-reads it, and the reader re-renders only where `isSame` says the value changed, so a reader
 * whose answer a load leaves alone costs no render. A null `select` asks nothing, so it watches no
 * load. `select` and `isSame` must be stable.
 */
export function useLiveTreeSelection<T>(
  select: ((tree: SharedLiveTree, snapshot: ResourceSnapshot) => T | undefined) | null,
  isSame: (a: T, b: T) => boolean
): T | undefined {
  const { sceneGraph, loader, project, controlTransforms } = useLiveTreeInputs();
  const readAt = useCallback(
    (version: number, snapshot: ResourceSnapshot) => {
      if (!sceneGraph || !select) return undefined;
      const tree = sharedTreeAt({ sceneGraph, loader, project, controlTransforms }, version);
      return tree ? select(tree, snapshot) : undefined;
    },
    [sceneGraph, project, loader, controlTransforms, select]
  );
  const isSameSelection = useCallback(
    (a: T | undefined, b: T | undefined) => sameSelection(a, b, isSame),
    [isSame]
  );
  return useReadAtLoadTick(select ? loader : null, readAt, isSameSelection);
}

/**
 * `read` on the snapshot the live tree and its passes read, so a file that both the tree and a
 * component read loads once and answers once to both. A load re-reads it, and the reader
 * re-renders only where `isSame` says the value changed. `read` and `isSame` must be stable.
 */
export function useLiveFilesRead<T>(
  read: (snapshot: ResourceSnapshot) => T,
  isSame: (a: T, b: T) => boolean
): T {
  const loader = useResourceLoader();
  const readAt = useCallback((_version: number, snapshot: ResourceSnapshot) => read(snapshot), [read]);
  return useReadAtLoadTick(loader, readAt, isSame);
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

const NO_ROOTS: readonly TscnNode[] = [];

/**
 * The tree over the caches of a loader, with no roots, for each project's tree settings: a question
 * about one node needs only the caches. Every step question of a load tick shares it.
 */
const loaderTreesOf = perObject((project: ProjectTreeSettings) =>
  valueAtLoadTick((loader) =>
    liveTreeOf(NO_ROOTS, {
      externalResources: [],
      internalResources: [],
      ...loaderCaches(loader),
      project,
    })
  )
);

/**
 * The step of `node` where it sits in `scope`, over the loader's caches. A reader re-renders only for
 * a load that changes its step, since the tree hands the same step back while every answer it read is
 * unchanged. A node that instances nothing reads no cache, so it watches no load. `scope` must be stable.
 *
 * @canonical The step of a node of the Live scene tree in a React reader
 */
export function useLiveStepOf(node: LiveNode, scope: SceneScope): LiveStep {
  const loader = useResourceLoader();
  const project = useProjectTreeSettings();
  const readsCaches =
    liveInstancePath(node, scope) !== null || glbPathOf(node) !== undefined || hasSceneTileCells(node);
  const watched = readsCaches ? loader : null;
  const readAt = useCallback(
    (version: number) => loaderTreesOf(project)(watched, version).stepOf(node, scope),
    [project, watched, node, scope]
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
