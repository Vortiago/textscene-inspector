/**
 * The live scene tree: one traversal that composes the root nodes, instancing
 * (Instance root merge, ADR-0013) and GLBSceneRoot internals into one node-path
 * space, each sub-scene's refs scoped to its own tables. It walks a snapshot of
 * the loader's caches, so the React consumers re-run it when a sub-scene loads.
 */
import type * as THREE from 'three';
import type { SceneScope, TscnNode, TscnExternalResource, TscnInternalResource } from '../parser/types.js';
import { liveInstancePath, scopeOf, type LiveNode } from '../resources/liveNode.js';
import { mergeInstanceRoot } from '../resources/mergeInstanceRoot.js';
// Re-exported here, where every walker already reaches for it.
export type { SceneScope };
import { glbPathOf, loneGlbRootPath } from '../resources/glbSceneRoot.js';
import { glbSceneRootChildren } from './internal/glb-scene-root/glbHierarchy.js';
import { splitAttachedChildren } from './internal/glb-scene-root/glbNodeOverrides.js';
import { joinPath } from '../utils/nodePath.js';
import { nodePathNames } from '../godot/string/nodePath.js';

/**
 * Read surface for the loader's PackedScene cache. `undefined` means never
 * requested, `null` means failed, and a value is the loaded scene with the pools
 * the cache holds. The pools are optional, unlike on {@link SceneScope}: an
 * absent pool means "this cache does not know", and the walk reads it as empty.
 */
export interface CachedSceneSource {
  getCached: (path: string) => (Partial<SceneScope> & { nodes: readonly TscnNode[] }) | null | undefined;
}

/** Read surface for the loader's GLB cache, so the walk can descend into a GLB's internals. */
export interface CachedGlbSource {
  getCached: (path: string) => THREE.Object3D | null | undefined;
}

export interface LiveTreeContext {
  /** The root scene's ExtResources, which its top-level instance refs resolve against. */
  externalResources: readonly TscnExternalResource[];
  /** The root scene's SubResources, which an instance's own overrides name. */
  internalResources: readonly TscnInternalResource[];
  sceneCache: CachedSceneSource;
  glbCache?: CachedGlbSource;
}

/** A node in the live tree: its effective (collapsed) identity and its full path. */
export interface LiveTreeEntry {
  node: LiveNode;
  path: string;
}

/**
 * A cache source that answers for one path, so a React walker can hand the walk the one
 * sub-scene or GLB it loaded. Any other path returns `undefined`, which keeps each mount's scope
 * to itself (ADR-0009). A value that is still loading or failed reads as not cached, so the node
 * stays uncollapsed.
 */
export function singlePathCache<T>(
  path: string | null | undefined,
  value: T | null | undefined
): { getCached: (path: string) => T | undefined } {
  return { getCached: (p) => (p === path ? (value ?? undefined) : undefined) };
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
export function collapseLiveNode(node: LiveNode, scope: SceneScope, sceneCache: CachedSceneSource): LiveNode {
  const scenePath = liveInstancePath(node, scope);
  const outer = scopeOf(node, scope);
  const enclosingScenePaths = outer.instancedScenePaths ?? [];
  if (!scenePath || enclosingScenePaths.includes(scenePath)) return node;
  const cached = sceneCache.getCached(scenePath);
  if (!cached) return node;
  const content = contentScopeOf(cached, [...enclosingScenePaths, scenePath]);
  const subScene = composedSubScene(cached, content, sceneCache);
  // A composed root's nodes resolve in its base's scope, which its own `scope` carries.
  const rootContent = subScene.nodes.length === 1 ? scopeOf(subScene.nodes[0]!, content) : content;
  return mergeInstanceRoot(node, subScene, { outer, content: rootContent }) ?? node;
}

/**
 * A loaded sub-scene as it instantiates by itself: its sole root collapsed over the base it
 * inherits, or the scene as cached where nothing collapses.
 */
function composedSubScene(
  cached: { nodes: readonly TscnNode[] },
  content: SceneScope,
  sceneCache: CachedSceneSource
): { nodes: readonly LiveNode[] } {
  if (cached.nodes.length !== 1) return cached;
  const root = cached.nodes[0]!;
  const composed = collapseLiveNode(root, content, sceneCache);
  return composed === root ? cached : { nodes: [composed] };
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
  /**
   * `merged` groups only: the collapsed node the instance became, so a caller
   * skips a second `mergeInstanceRoot` pass. On every other origin the raw
   * node is the effective node.
   */
  mergedNode?: LiveNode;
}

/**
 * What is below a node: one `inline` group for a non-instance, one `merged`
 * group for a single-root instance, `inline` plus `subscene` for a multi-root or
 * GLB instance, and one `glb` group for a GLBSceneRoot. `scope` is the group's the
 * node sits in, which the node's own `scope` replaces. A sub-scene's groups read the
 * sub-scene's pools from the cache, and their `instancedScenePaths` gain the
 * sub-scene. An instance of a scene that already encloses it (cyclic instancing)
 * gets one `inline` group.
 */
export function liveChildGroups(
  node: LiveNode,
  scope: SceneScope,
  sceneCache: CachedSceneSource,
  glbCache?: CachedGlbSource
): LiveChildGroup[] {
  const own = scopeOf(node, scope);
  const inlineOnly = (): LiveChildGroup[] => [{ origin: 'inline', children: node.children, scope: own }];

  // GLB nodes carry no instance refs, so they stay in the outer scope.
  const glbPath = glbPathOf(node);
  const glbObject = glbPath ? glbCache?.getCached(glbPath) : undefined;
  if (glbObject) {
    return [{ origin: 'glb', children: glbSceneRootChildren(glbObject, node.children), scope: own }];
  }

  const scenePath = liveInstancePath(node, scope);
  if (!scenePath) return inlineOnly();

  // Cyclic instancing: Godot never loads the scene here, so nothing of it is below.
  const enclosingScenePaths = own.instancedScenePaths ?? [];
  if (enclosingScenePaths.includes(scenePath)) return inlineOnly();

  const cached = sceneCache.getCached(scenePath);
  if (!cached) return inlineOnly();

  const merged = collapseLiveNode(node, own, sceneCache);
  if (merged !== node) {
    return [{ origin: 'merged', children: merged.children, scope: scopeOf(merged, own), mergedNode: merged }];
  }

  // Inline children are authored in the host scene, so they keep the outer scope. A typed child
  // addressed into a GLB moves below the GLB node its path names, where Godot adds it.
  const { glbRoot, attached, rest } = placeInGlb(node.children, cached.nodes, own, glbCache);
  const groups: LiveChildGroup[] = [];
  if (rest.length > 0) {
    groups.push({ origin: 'inline', children: rest, scope: own });
  }
  groups.push({
    origin: 'subscene',
    children: glbRoot ? [{ ...glbRoot, children: attached }] : cached.nodes,
    scope: contentScopeOf(cached, [...enclosingScenePaths, scenePath]),
  });
  return groups;
}

/**
 * The host's children split for an instance of a lone GLB: those below the GLB's nodes, each stamped
 * with the host's scope since the GLB scene's pools are not the ones it was authored against, and
 * the rest. `glbRoot` is the GLB's synthetic root, absent for any other instance.
 */
function placeInGlb(
  hostChildren: LiveNode[],
  contentRoots: readonly TscnNode[],
  hostScope: SceneScope,
  glbCache: CachedGlbSource | undefined
): { glbRoot?: LiveNode; attached: LiveNode[]; rest: LiveNode[] } {
  const glbPath = loneGlbRootPath(contentRoots);
  const object = glbPath ? glbCache?.getCached(glbPath) : undefined;
  if (!object) return { attached: [], rest: hostChildren };
  const { attached, rest } = splitAttachedChildren(object, hostChildren);
  return {
    glbRoot: contentRoots[0] as LiveNode,
    attached: attached.map((child) => (child.scope ? child : { ...child, scope: hostScope })),
    rest,
  };
}

/** The collapsed node a `merged` group carries, so a walker merges each instance once. */
export function mergedNodeOf(groups: readonly LiveChildGroup[]): LiveNode | undefined {
  return groups[0]?.mergedNode;
}

/**
 * The scope the refs of `node` as the tree shows it resolve against, given its
 * `groups` from {@link liveChildGroups}: the merged instance's, else the node's own,
 * else the one of the group it sits in (`groupScope`).
 */
export function liveNodeScope(
  node: LiveNode,
  groupScope: SceneScope,
  groups: readonly LiveChildGroup[]
): SceneScope {
  return mergedNodeOf(groups) ? groups[0]!.scope : scopeOf(node, groupScope);
}

/**
 * The first node called `name` across `groups`, as a path walk descends: with the scope its own
 * refs and children resolve against.
 */
function liveChildNamed(
  groups: readonly LiveChildGroup[],
  name: string
): { node: LiveNode; scope: SceneScope } | undefined {
  for (const group of groups) {
    const node = group.children.find((n) => n.name === name);
    if (node) return { node, scope: scopeOf(node, group.scope) };
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

  const tree = new LiveTree(roots, ctx);
  const links: LiveChainLink[] = [];
  let livePath = '';
  for (const segment of segments) {
    livePath = joinPath(livePath, segment);
    const link = tree.at(livePath);
    if (!link) return null;
    links.push({ raw: link.node, collapsed: mergedNodeOf(link.groups) ?? link.node });
  }

  return links;
}

/** The groups a walk of the live tree starts from: the outer roots, in the root scene's scope. */
export function rootGroups(roots: readonly TscnNode[], ctx: LiveTreeContext): readonly LiveChildGroup[] {
  return [{ origin: 'inline', children: roots, scope: rootScope(ctx) }];
}

/** A node of the live tree, before its collapse, with its child groups. */
export interface LiveLink {
  readonly node: LiveNode;
  readonly scope: SceneScope;
  readonly groups: readonly LiveChildGroup[];
}

/**
 * The live tree over one cache snapshot, each node's child groups walked once however many paths
 * pass through it. A caller makes one per question, since the snapshot changes on each load.
 */
export class LiveTree {
  /** Written only by `at`. A null marks a path the loaded tree does not contain. */
  private readonly links = new Map<string, LiveLink | null>();

  constructor(
    readonly roots: readonly TscnNode[],
    readonly ctx: LiveTreeContext
  ) {}

  /** The node at the live path `path`, or null where the loaded tree stops. */
  at(path: string): LiveLink | null {
    const cached = this.links.get(path);
    if (cached !== undefined) return cached;
    const slash = path.lastIndexOf('/');
    const parentGroups = slash < 0 ? rootGroups(this.roots, this.ctx) : this.at(path.slice(0, slash))?.groups;
    const found = parentGroups && liveChildNamed(parentGroups, path.slice(slash + 1));
    const link = found
      ? { ...found, groups: liveChildGroups(found.node, found.scope, this.ctx.sceneCache, this.ctx.glbCache) }
      : null;
    this.links.set(path, link);
    return link;
  }
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

/** Depth-first walk of the live tree, calling `visit` with each collapsed node and its full path. */
export function walkLiveTree(
  roots: readonly TscnNode[],
  ctx: LiveTreeContext,
  visit: (entry: LiveTreeEntry) => void,
  descend?: (node: LiveNode) => boolean
): void {
  const walk = (nodes: readonly LiveNode[], scope: SceneScope, parentPath: string): void => {
    for (const node of nodes) {
      const path = joinPath(parentPath, node.name);
      const groups = liveChildGroups(node, scope, ctx.sceneCache, ctx.glbCache);
      const effective = mergedNodeOf(groups) ?? node;
      visit({ node: effective, path });
      // `descend` prunes only the children, so a consumer can count a boundary
      // without counting what is behind it.
      if (descend && !descend(effective)) continue;
      for (const group of groups) {
        walk(group.children, group.scope, path);
      }
    }
  };
  walk(roots, rootScope(ctx), '');
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
