/**
 * The live scene tree: one traversal that composes the root nodes, instancing
 * (Instance root merge, ADR-0013) and GLBSceneRoot internals into one node-path
 * space, each sub-scene's refs scoped to its own tables. It walks a snapshot of
 * the loader's caches, so the React consumers re-run it when a sub-scene loads.
 */
import type * as THREE from 'three';
import type { SceneScope, TscnNode, TscnExternalResource, TscnInternalResource } from '../parser/types.js';
import { liveInstancePath, scopeOf, withFallbackScope, type LiveNode } from '../resources/liveNode.js';
import { mergeInstanceRoot } from '../resources/mergeInstanceRoot.js';
import { followTrailIn } from '../resources/sceneTrail.js';
import type { TrailWalk } from '../godot/scene/packedScene.js';
import { holdsDeepChildren, seatInFile, type CollapseInstance } from '../resources/seatEscaped.js';
import { cachedUniqueNamesBelowRoot } from '../utils/uniqueNames.js';
// Re-exported here, where every walker already reaches for it.
export type { SceneScope };
import { glbPathOf, loneGlbRootPath } from '../resources/glbSceneRoot.js';
import { glbSceneRootChildren } from './internal/glb-scene-root/glbHierarchy.js';
import { splitAttachedChildren } from './internal/glb-scene-root/glbNodeOverrides.js';
import { joinPath } from '../utils/nodePath.js';
import { nodePathNames } from '../godot/string/nodePath.js';
import { sameElements } from '../utils/sameElements.js';
import { perObject } from '../utils/perObject.js';
import { NOTHING_CACHED, answeredOnce, keptWhileAnswered } from './cacheSources.js';

/**
 * Read surface for the loader's PackedScene cache. `undefined` means never
 * requested, `null` means failed, and a value is the loaded scene with the pools
 * the cache holds. The pools are optional, unlike on {@link SceneScope}: an
 * absent pool means "this cache does not know", and the walk reads it as empty.
 */
export interface CachedSceneSource {
  getCached: (path: string) => (Partial<SceneScope> & { nodes: readonly TscnNode[] }) | null | undefined;
}

type CachedScene = NonNullable<ReturnType<CachedSceneSource['getCached']>>;

/** Read surface for the loader's GLB cache, so the walk can descend into a GLB's internals. */
export interface CachedGlbSource {
  getCached: (path: string) => THREE.Object3D | null | undefined;
}

/**
 * One context is one snapshot of the loader's caches: the walks over it read each scene path from
 * `sceneCache` once. A caller whose cache changes builds a new context.
 */
export interface LiveTreeContext {
  /** The root scene's ExtResources, which its top-level instance refs resolve against. */
  externalResources: readonly TscnExternalResource[];
  /** The root scene's SubResources, which an instance's own overrides name. */
  internalResources: readonly TscnInternalResource[];
  sceneCache: CachedSceneSource;
  glbCache?: CachedGlbSource;
}

/** The scene cache of `ctx` as the walks over it read it: each path asked of the loader once. */
const snapshotScenes = perObject((ctx: LiveTreeContext): CachedSceneSource => answeredOnce(ctx.sceneCache));

/** A node in the live tree: its effective (collapsed) identity and its full path. */
export interface LiveTreeEntry {
  node: LiveNode;
  path: string;
}

/**
 * The node as the tree and viewport render it: a single-root `.tscn` instance
 * collapses into its sub-scene root (Instance root merge, ADR-0013), carrying the
 * sub-scene's scope. A `.glb` or multi-root instance, a non-instance, a scene not
 * yet cached and a scene already in `scope.instancedScenePaths` (cyclic
 * instancing) return unchanged.
 *
 * An inherited sub-scene root collapses over its base first, as Godot instantiates the base
 * before the inheriting file's headings land (packed_scene.cpp:227-231), and the host merges
 * onto that composed root. The chain stops at a scene that already encloses the node, so a
 * scene that inherits or instances itself ends.
 */
function collapseLiveNode(node: LiveNode, scope: SceneScope, sceneCache: CachedSceneSource): LiveNode {
  const own = scopeOf(node, scope);
  const scenePath = loadableScenePath(node, own);
  if (!scenePath) return node;
  const cached = sceneCache.getCached(scenePath);
  if (!cached) return node;
  return collapseOver(node, own, scenePath, cached, sceneCache);
}

/**
 * The `res://` path of the scene `node` instances where its scope is `own` ({@link scopeOf}), or null where it
 * instances none or a scene that already encloses it. Godot never loads a cyclic instance, so
 * nothing of it is below the node.
 */
function loadableScenePath(node: LiveNode, own: SceneScope): string | null {
  const scenePath = liveInstancePath(node, own);
  const enclosingScenePaths = own.instancedScenePaths ?? [];
  return scenePath && !enclosingScenePaths.includes(scenePath) ? scenePath : null;
}

/** The collapse of `node` over `cached`, the scene at `scenePath` that the caller read once. */
function collapseOver(
  node: LiveNode,
  outer: SceneScope,
  scenePath: string,
  cached: CachedScene,
  sceneCache: CachedSceneSource
): LiveNode {
  const content = contentScopeOf(cached, [...(outer.instancedScenePaths ?? []), scenePath]);
  const subScene = composedSubScene(cached, content, sceneCache);
  // A composed root's nodes resolve in its base's scope, which its own `scope` carries.
  const rootContent = subScene.nodes.length === 1 ? scopeOf(subScene.nodes[0]!, content) : content;
  const cache = { collapse: collapserOver(sceneCache), followTrail: followTrailIn(cached, sceneCache) };
  return mergeInstanceRoot(node, subScene, { outer, content: rootContent }, cache) ?? node;
}

/** `collapseLiveNode` over `sceneCache`, as the seating takes it. */
function collapserOver(sceneCache: CachedSceneSource): CollapseInstance {
  return (node, scope) => collapseLiveNode(node, scope, sceneCache);
}

/**
 * The sources that ask about one scene in one chain at once: the loader's cache, and the
 * single-path source of a tree row. Two keep each from replacing the other's composition.
 */
const COMPOSITIONS_PER_CHAIN = 2;

/**
 * Written only by {@link composedSubScene}, keyed by the cached scene object. A scene composes once
 * for each chain of scenes that encloses it, since the cyclic-instancing check reads that chain.
 */
const compositions = keptWhileAnswered<
  CachedScene,
  readonly string[],
  { scenes: CachedSceneSource },
  { nodes: readonly LiveNode[] }
>({ sameVariant: sameElements, perVariant: COMPOSITIONS_PER_CHAIN });

/**
 * A loaded sub-scene as it instantiates by itself: its sole root collapsed over the base it
 * inherits, with the children its own instances handed back seated, or the scene as cached where
 * nothing changes. A composition is reused while the cache still answers what it read, so every
 * instance shares one `%Name` table. The source may be the loader's live cache, which changes in place.
 */
function composedSubScene(
  cached: CachedScene,
  content: SceneScope,
  sceneCache: CachedSceneSource
): { nodes: readonly LiveNode[] } {
  const root = cached.nodes[0];
  if (cached.nodes.length !== 1 || !root || !(root.instance || holdsDeepChildren(root))) return cached;
  // The recording source also sees the reads of a base's own composition, so a change of any base ends this entry.
  return compositions(cached, content.instancedScenePaths ?? [], { scenes: sceneCache }, ({ scenes }) =>
    composedOverBases(cached, root, content, scenes)
  );
}

/** `cached` with its sole `root` collapsed over its bases and seated, or the same scene where nothing changes. */
function composedOverBases(
  cached: CachedScene,
  root: LiveNode,
  content: SceneScope,
  sceneCache: CachedSceneSource
): { nodes: readonly LiveNode[] } {
  const collapsed = collapseLiveNode(root, content, sceneCache);
  const [seated] = seatedFile([collapsed], content, sceneCache, cached.nodes);
  return seated === root ? cached : { nodes: [seated!] };
}

/**
 * The nodes of one file with the children their instances handed back seated where the file's own
 * walk puts them. The same array where no instance hands one back.
 *
 * @param roots the file's nodes, collapsed over the base an inherited root names
 * @param scope the scope the file's nodes resolve against
 * @param seating the nodes as the parse seated them, whose `%Name` claims the file answers a walk with
 */
function seatedFile(
  roots: readonly LiveNode[],
  scope: SceneScope,
  sceneCache: CachedSceneSource,
  seating: readonly LiveNode[]
): readonly LiveNode[] {
  const root = roots[0];
  if (roots.length !== 1 || !root || !(holdsDeepChildren(root) || root.escaped)) return roots;
  const collapse = collapserOver(sceneCache);
  // A root that inherits a base, not merged over it yet, hands back through its collapse.
  const isUnmerged = root.instance !== undefined && root.uniqueNames === undefined;
  const handedBack = (isUnmerged ? collapse(root, scope) : root).escaped ?? [];
  const table = root.uniqueNames;
  const seated = seatInFile(
    {
      root,
      scope: scopeOf(root, scope),
      claimed: (key) => (table ? table.paths() : cachedUniqueNamesBelowRoot(seating)).get(key),
      handedBack,
    },
    collapse
  );
  return seated === root ? roots : [seated];
}

/**
 * The scope a loaded sub-scene's own nodes resolve against. An absent pool reads
 * as empty, never as the caller's: these ids belong to the sub-scene's file.
 */
function contentScopeOf(cached: Partial<SceneScope>, instancedScenePaths: readonly string[]): SceneScope {
  return {
    externalResources: cached.externalResources ?? [],
    internalResources: cached.internalResources ?? [],
    instancedScenePaths,
  };
}

/**
 * The root {@link SceneScope} for a path or tree walk: the root scene's own pools. A copy, not
 * the context itself, so no scope a node keeps holds the loader's caches.
 */
export function rootScope(ctx: LiveTreeContext): SceneScope {
  return { externalResources: ctx.externalResources, internalResources: ctx.internalResources };
}

/**
 * One group of live children. `origin` is the React key namespace. `merged` and
 * `subscene` children resolve in the sub-scene's scope, `inline` and `glb`
 * children in the outer scope.
 */
export interface LiveChildGroup {
  origin: 'merged' | 'inline' | 'subscene' | 'glb';
  children: readonly LiveNode[];
  /** Both pools this group's children resolve their own refs against, as a {@link SceneScope}. */
  scope: SceneScope;
}

function inlineGroup(children: readonly TscnNode[], scope: SceneScope): LiveChildGroup {
  return { origin: 'inline', children, scope };
}

/**
 * What is below a node that does not collapse: one `inline` group for a non-instance,
 * `inline` plus `subscene` for a multi-root instance, and one `glb` group for a
 * GLBSceneRoot. A single-root instance collapses, and {@link mergedGroups} gives its groups.
 * The node that instances a lone GLB is the GLB root, so a loaded GLB's objects are `glb`
 * groups and its own children `inline` groups, in the order `index=` gives. `scope` is
 * the one of the group the node sits in, which the node's own `scope` replaces. A sub-scene's
 * groups read the sub-scene's pools from the cache, and their `instancedScenePaths` gain the
 * sub-scene. An instance of a scene that already encloses it (cyclic instancing)
 * gets one `inline` group.
 */
function liveChildGroups(
  node: LiveNode,
  scope: SceneScope,
  sceneCache: CachedSceneSource,
  glbCache?: CachedGlbSource
): LiveChildGroup[] {
  const own = scopeOf(node, scope);
  const inlineOnly = (): LiveChildGroup[] => [inlineGroup(node.children, own)];

  // GLB nodes carry no instance refs, so they stay in the outer scope.
  const glbPath = glbPathOf(node);
  const glbObject = glbPath ? glbCache?.getCached(glbPath) : undefined;
  if (glbObject) return glbInstanceGroups(glbObject, node.children, own);

  const scenePath = loadableScenePath(node, own);
  if (!scenePath) return inlineOnly();

  const cached = sceneCache.getCached(scenePath);
  if (!cached) return inlineOnly();

  // A lone GLB is the instancing node's own content: its objects sit directly below that node, as
  // the GLB root's children do in Godot (packed_scene.cpp:261-264). Until the GLB loads, the
  // node's children stay inline.
  const instancedGlbPath = loneGlbRootPath(cached.nodes);
  if (instancedGlbPath) {
    const object = glbCache?.getCached(instancedGlbPath);
    return object ? glbInstanceGroups(object, node.children, own) : inlineOnly();
  }

  // Inline children are authored in the host scene, so they keep the outer scope.
  const groups: LiveChildGroup[] = [];
  if (node.children.length > 0) {
    groups.push(inlineGroup(node.children, own));
  }
  groups.push({
    origin: 'subscene',
    children: cached.nodes,
    scope: contentScopeOf(cached, [...(own.instancedScenePaths ?? []), scenePath]),
  });
  return groups;
}

/**
 * The groups of a collapsed instance. A sub-scene root that instances a loaded lone GLB leaves
 * the merged node the GLB root, so its objects sit directly below it.
 */
function mergedGroups(
  merged: LiveNode,
  outer: SceneScope,
  sceneCache: CachedSceneSource,
  glbCache?: CachedGlbSource
): LiveChildGroup[] {
  const scope = scopeOf(merged, outer);
  const object = instancedGlbObject(merged, scope, sceneCache, glbCache);
  if (!object) return [{ origin: 'merged', children: merged.children, scope }];
  return glbInstanceGroups(object, merged.children, scope);
}

/** The loaded GLB `node` instances as the only root of its sub-scene, or undefined. */
function instancedGlbObject(
  node: LiveNode,
  scope: SceneScope,
  sceneCache: CachedSceneSource,
  glbCache?: CachedGlbSource
): THREE.Object3D | undefined {
  const scenePath = loadableScenePath(node, scope);
  if (!scenePath) return undefined;
  const glbPath = loneGlbRootPath(sceneCache.getCached(scenePath)?.nodes ?? []);
  return glbPath ? (glbCache?.getCached(glbPath) ?? undefined) : undefined;
}

/**
 * The groups of a node that instances a lone GLB: the GLB's objects, with the host's typed children
 * below the GLB nodes their parent paths name, and the host's other children after them, or at the
 * `index=` they state. Each typed child takes the host's scope when it carries none, since the GLB
 * scene's pools are not the ones it was authored against.
 */
function glbInstanceGroups(
  object: THREE.Object3D,
  hostChildren: LiveNode[],
  hostScope: SceneScope
): LiveChildGroup[] {
  const { attached, rest } = splitAttachedChildren(object, hostChildren);
  const stamped = attached.map((child) => withFallbackScope(child, hostScope));
  const ordered = glbSceneRootChildren(object, stamped, rest);
  if (rest.length === 0) return [{ origin: 'glb', children: ordered, scope: hostScope }];
  const hostOwn = new Set<TscnNode>(rest);
  const runs: { origin: 'glb' | 'inline'; children: TscnNode[] }[] = [];
  for (const child of ordered) {
    const origin = hostOwn.has(child) ? 'inline' : 'glb';
    if (runs.at(-1)?.origin === origin) runs.at(-1)!.children.push(child);
    else runs.push({ origin, children: [child] });
  }
  return runs.map((run) => ({ ...run, scope: hostScope }));
}

/**
 * One step of the live tree. A reader takes all three parts from here: the raw node and the
 * scope of the group it sits in are the wrong ones for an instance root and for a grafted node.
 */
export interface LiveStep {
  /** The node as the tree and viewport show it: collapsed into its sub-scene root where it instances one. */
  readonly node: LiveNode;
  /** Whether `node` is the sub-scene root the instance collapsed into, rather than the node as authored. */
  readonly isMerged: boolean;
  /**
   * The `res://` path of the scene the node as authored instances, resolved in its authored scope, or
   * null. It is neither `instanceSubPath`, a node path inside the instance, nor
   * `SceneScope.instancedScenePaths`, the chain of scenes that enclose the node.
   */
  readonly instancePath: string | null;
  /**
   * The scope the refs of `node` and of its children resolve against: the sub-scene's for a collapsed
   * instance, else the node's own scope ({@link scopeOf}), else the one of the group it sits in.
   */
  readonly scope: SceneScope;
  /** What is below the node, in the order the tree shows it. */
  readonly groups: readonly LiveChildGroup[];
}

/**
 * The step for `node` where it sits in a group of scope `groupScope`. An instance merges once
 * here, so no reader merges a second time. Readers take it through {@link LiveTree.stepOf}, which
 * keeps it.
 */
function liveStep(
  node: LiveNode,
  groupScope: SceneScope,
  sceneCache: CachedSceneSource,
  glbCache?: CachedGlbSource
): LiveStep {
  const instancePath = liveInstancePath(node, groupScope);
  const merged = collapseLiveNode(node, groupScope, sceneCache);
  if (merged === node) {
    const groups = liveChildGroups(node, groupScope, sceneCache, glbCache);
    return { node, isMerged: false, instancePath, scope: scopeOf(node, groupScope), groups };
  }
  const groups = mergedGroups(merged, scopeOf(node, groupScope), sceneCache, glbCache);
  return { node: merged, isMerged: true, instancePath, scope: groups[0]!.scope, groups };
}

/** Whether `group` holds sub-scene roots or GLB objects, which draw after the node's authored children. */
export function isInjected(group: LiveChildGroup): boolean {
  return group.origin === 'subscene' || group.origin === 'glb';
}

/** Whether `group` is what the node instances, which the instance node owns as the root of it. */
export function holdsInstanceContent(group: LiveChildGroup): boolean {
  return group.origin === 'merged' || group.origin === 'glb';
}

/** The first child called `name` across `groups`, as a path walk descends, with the group it sits in. */
function liveChildNamed(
  groups: readonly LiveChildGroup[],
  name: string
): { raw: LiveNode; group: LiveChildGroup } | undefined {
  for (const group of groups) {
    const raw = group.children.find((n) => n.name === name);
    if (raw) return { raw, group };
  }
  return undefined;
}

/**
 * One link of the resolved chain: the collapsed node at a path segment and the
 * raw node it came from. The raw node's `instance` is the originating instance
 * that the tree's 📦 badge reads. The collapsed node's `instance` is the
 * sub-scene root's own.
 */
interface LiveChainLink {
  raw: LiveNode;
  collapsed: LiveNode;
}

/**
 * The walk {@link liveNodeChain} and {@link resolveLiveEntry} share: descend a
 * path, collapsing each segment, or `null` if any is unresolvable. The groups
 * stay apart rather than one flat list, so the matched node descends in its own
 * group's scope.
 */
function liveChainLinks(
  path: string,
  roots: readonly TscnNode[],
  ctx: LiveTreeContext
): LiveChainLink[] | null {
  const segments = nodePathNames(path);
  if (segments.length === 0) return null;

  const tree = liveTreeOf(roots, ctx);
  const links: LiveChainLink[] = [];
  let livePath = '';
  for (const segment of segments) {
    livePath = joinPath(livePath, segment);
    const link = tree.at(livePath);
    if (!link) return null;
    links.push({ raw: link.raw, collapsed: link.step.node });
  }

  return links;
}

/** A node of the live tree as authored, with its step, its full path and the group it sits in. */
export interface LiveLink {
  readonly raw: LiveNode;
  readonly step: LiveStep;
  readonly path: string;
  /** The group `raw` sits in, whose scope `raw`'s own refs fall back to. */
  readonly group: LiveChildGroup;
}

/**
 * The live tree over one cache snapshot, each node's step taken once however many paths pass
 * through it. Every question over one context gets the tree {@link liveTreeOf} returns.
 *
 * @canonical A walk of the Live scene tree
 *   Fold it with `LiveTree.fold`, read one path with `LiveTree.at`, and one step with `LiveTree.stepOf`.
 */
export class LiveTree {
  /** The groups a walk starts from: the outer roots, in the root scene's scope. */
  readonly rootGroups: readonly LiveChildGroup[];
  /**
   * `roots` with the headings their instances hand back seated where the file's walk puts them. The
   * rows and the viewport draw from these, since each instance they enter collapses on its own.
   */
  readonly seatedRoots: readonly TscnNode[];
  /** Written only by `at`. A null marks a path the loaded tree does not contain. */
  private readonly links = new Map<string, LiveLink | null>();
  private readonly scenes: CachedSceneSource;
  private readonly sources: { scenes: CachedSceneSource; glbs: CachedGlbSource };

  constructor(
    readonly roots: readonly TscnNode[],
    readonly ctx: LiveTreeContext
  ) {
    this.scenes = snapshotScenes(ctx);
    this.sources = { scenes: this.scenes, glbs: ctx.glbCache ?? NOTHING_CACHED };
    const scope = rootScope(ctx);
    this.seatedRoots = seatedFile(roots, scope, this.scenes, roots);
    this.rootGroups = [inlineGroup(this.seatedRoots, scope)];
  }

  /** The root nodes of the loaded scene at `scenePath`, or undefined while it is not loaded. */
  sceneNodes(scenePath: string): readonly TscnNode[] | undefined {
    return this.scenes.getCached(scenePath)?.nodes;
  }

  /**
   * Follows `trail` in the loaded scene at `scenePath`, where an instance holds the owner an
   * `owner_uid_path=` names. A scene that is not loaded yet makes the trail wait.
   */
  followTrail(scenePath: string, trail: readonly number[]): TrailWalk {
    const scene = this.scenes.getCached(scenePath);
    return scene
      ? followTrailIn(scene, this.scenes)(trail)
      : { status: scene === null ? 'missing' : 'pending' };
  }

  /** The node at the live path `path`, or null where the loaded tree stops. */
  at(path: string): LiveLink | null {
    const cached = this.links.get(path);
    if (cached !== undefined) return cached;
    const slash = path.lastIndexOf('/');
    const parentGroups = slash < 0 ? this.rootGroups : this.at(path.slice(0, slash))?.step.groups;
    const found = parentGroups && liveChildNamed(parentGroups, path.slice(slash + 1));
    const link = found ? this.linkTo(found.raw, found.group, path) : null;
    this.links.set(path, link);
    return link;
  }

  /** The link for `raw` where it sits in `group` at `path`. */
  private linkTo(raw: LiveNode, group: LiveChildGroup, path: string): LiveLink {
    return { raw, step: this.stepOf(raw, group.scope), path, group };
  }

  /**
   * The step for `node` where it sits in `scope`, taken once. A node is found by itself and its
   * scope, never by its path: two siblings may share a name, and a sub-scene's nodes sit at
   * every instance of it. A tree over a later snapshot gives the same step while every answer the
   * step read is unchanged.
   */
  stepOf(node: LiveNode, scope: SceneScope): LiveStep {
    return stepsByNode(node, scopeOf(node, scope), this.sources, ({ scenes, glbs }) =>
      liveStep(node, scope, scenes, glbs)
    );
  }

  /**
   * Depth-first fold of the tree. `visit` gets each node with what its parent passed down, and a
   * `descend` that folds the node's children, in group order, with what this node passes down. A
   * visit that never calls `descend` prunes the children. The results come back in order.
   * It starts at the roots unless given the link of a node, so a fold of its subtree reads the
   * steps the other walks of this tree took.
   */
  fold<Inherited, Result>(
    inherited: Inherited,
    visit: FoldVisit<Inherited, Result>,
    from?: LiveLink
  ): Result[] {
    const results: Result[] = [];
    for (const group of from ? from.step.groups : this.rootGroups) {
      for (const raw of group.children) {
        const link = this.linkTo(raw, group, joinPath(from?.path ?? '', raw.name));
        const descend = (passedDown: Inherited): Result[] => this.fold(passedDown, visit, link);
        results.push(visit(link, inherited, descend));
      }
    }
    return results;
  }
}

/**
 * Written only by {@link LiveTree.stepOf}: the steps of a node under each scope it was asked in.
 * They outlive the tree that took them, since a load that a step did not read leaves it as it is.
 * A sub-scene's node is asked under each chain of scenes that encloses it, so a node keeps every
 * scope it was asked in: an evicting limit would take the step again at each load. The scopes are
 * the scenes' own and finite, and the entries clear when nothing holds the node any more.
 */
const stepsByNode = keptWhileAnswered<
  LiveNode,
  SceneScope,
  { scenes: CachedSceneSource; glbs: CachedGlbSource },
  LiveStep
>({ sameVariant: sameScope, perVariant: 1 });

/** What a fold of the live tree does at each node. */
type FoldVisit<Inherited, Result> = (
  link: LiveLink,
  inherited: Inherited,
  descend: (passedDown: Inherited) => Result[]
) => Result;

const NO_PATHS: readonly string[] = [];

function sameScope(a: SceneScope, b: SceneScope): boolean {
  return (
    a === b ||
    (a.externalResources === b.externalResources &&
      a.internalResources === b.internalResources &&
      sameElements(a.instancedScenePaths ?? NO_PATHS, b.instancedScenePaths ?? NO_PATHS))
  );
}

/**
 * Written only by {@link liveTreeOf}: one tree for each context and roots. A tree clears when
 * nothing holds its context or its roots any more.
 */
const liveTreesOver = perObject((ctx: LiveTreeContext) =>
  perObject((roots: readonly TscnNode[]) => new LiveTree(roots, ctx))
);

/** The live tree every question over `ctx` shares, so a node collapses once for all of them. */
export function liveTreeOf(roots: readonly TscnNode[], ctx: LiveTreeContext): LiveTree {
  return liveTreesOver(ctx)(roots);
}

/**
 * The collapsed nodes from the root down to the path's target, or `null` if any
 * segment is unresolvable. Each element is collapsed, so an ancestor-transform
 * walk such as `node2dWorldPosition` sees an instance's merged properties.
 */
export function liveNodeChain(
  path: string,
  roots: readonly TscnNode[],
  ctx: LiveTreeContext
): LiveNode[] | null {
  const links = liveChainLinks(path, roots, ctx);
  return links ? links.map((l) => l.collapsed) : null;
}

export interface ResolvedLiveNode {
  /** The collapsed node, the identity the tree and viewport render. */
  node: LiveNode;
  /**
   * The node's own pre-collapse `instance` ref, or `undefined` for a
   * non-instance node. The inspector's 📦 indicator reads it, since the
   * collapsed `node.instance` is the sub-scene root's ref.
   */
  instanceRef: string | undefined;
}

/**
 * The collapsed node at a path with its originating instance ref, or `null` if
 * any segment is unresolvable. A single-root sub-scene collapses into its
 * instance node (ADR-0013), so the root's own name is not a path segment.
 */
export function resolveLiveEntry(
  path: string,
  roots: readonly TscnNode[],
  ctx: LiveTreeContext
): ResolvedLiveNode | null {
  const links = liveChainLinks(path, roots, ctx);
  if (!links || links.length === 0) return null;
  const last = links[links.length - 1]!;
  return { node: last.collapsed, instanceRef: last.raw.instance };
}

/**
 * Depth-first walk of the live tree, calling `visit` with each collapsed node and its full path.
 *
 * @canonical A walk of the Live scene tree
 */
export function walkLiveTree(
  roots: readonly TscnNode[],
  ctx: LiveTreeContext,
  visit: (entry: LiveTreeEntry) => void,
  descend?: (node: LiveNode) => boolean
): void {
  liveTreeOf(roots, ctx).fold<void, void>(undefined, ({ step, path }, _, descendInto) => {
    visit({ node: step.node, path });
    // `descend` prunes only the children, so a consumer can count a boundary
    // without counting what is behind it.
    if (!descend || descend(step.node)) descendInto();
  });
}

/**
 * Every live-tree node whose collapsed identity satisfies `predicate`, with its
 * path. `descend` returns false for a node whose children are not collected. A
 * sub-viewport's content shows only through its surface, so the 2D-content hint
 * stops there while the scene tree panel does not.
 */
export function collectLiveNodes(
  roots: readonly TscnNode[],
  ctx: LiveTreeContext,
  predicate: (node: LiveNode) => boolean,
  descend?: (node: LiveNode) => boolean
): LiveTreeEntry[] {
  const out: LiveTreeEntry[] = [];
  walkLiveTree(
    roots,
    ctx,
    (entry) => {
      if (predicate(entry.node)) out.push(entry);
    },
    descend
  );
  return out;
}
