/**
 * The live scene tree: one traversal that composes the root nodes, instancing
 * (Instance root merge, ADR-0013) and GLBSceneRoot internals into one node-path
 * space, each sub-scene's refs scoped to its own tables. It walks a snapshot of
 * the loader's caches, so the React consumers re-run it when a sub-scene loads.
 */
import type * as THREE from 'three';
import type { SceneScope, TscnNode, TscnExternalResource, TscnInternalResource } from '../parser/types.js';
import { scopeOf, type LiveNode } from '../resources/liveNode.js';
import { resolveInstancePath } from '../resources/SubResourceResolver.js';
import { mergeInstanceRoot } from '../resources/mergeInstanceRoot.js';
// Re-exported here, where every walker already reaches for it.
export type { SceneScope };
import { GLB_SCENE_ROOT_TYPE } from './internal/glb-scene-root/Component.js';
import { glbSceneRootChildren } from './internal/glb-scene-root/glbHierarchy.js';
import { joinPath } from '../utils/nodePath.js';
import { nodePathNames } from '../godot/nodePath.js';

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
  /**
   * The root scene's SubResources, which an instance's own overrides name. Absent reads as
   * empty, for a consumer that never reads an override's SubResource.
   */
  internalResources?: readonly TscnInternalResource[];
  sceneCache: CachedSceneSource;
  glbCache?: CachedGlbSource;
}

/** A node in the live tree: its effective (collapsed) identity and its full path. */
export interface LiveTreeEntry {
  node: LiveNode;
  path: string;
}

/**
 * A {@link CachedSceneSource} that answers for one path, so a React walker can
 * hand `collapseLiveNode` the one sub-scene it loaded. Any other path returns
 * `undefined`, which keeps each mount's scope to itself (ADR-0009). A scene that
 * is still loading or failed reads as not cached, so the node stays uncollapsed.
 */
export function singleSceneCache(
  path: string | null | undefined,
  scene: (Partial<SceneScope> & { nodes: readonly TscnNode[] }) | null | undefined
): CachedSceneSource {
  return { getCached: (p) => (p === path ? (scene ?? undefined) : undefined) };
}

/**
 * The node as the tree and viewport render it: a single-root `.tscn` instance
 * collapses into its sub-scene root (Instance root merge, ADR-0013), carrying the
 * sub-scene's scope. A `.glb` or multi-root instance, a non-instance, a scene not
 * yet cached and a scene already in `scope.instancedScenePaths` (cyclic
 * instancing) return unchanged.
 *
 * It collapses an instance chain to a fixed point, not one level. A host override
 * such as `visible = false` on a heading with no `type=` stays in `rawProperties`
 * until a level with a real type re-parses it, so one level loses it. The chain
 * stops at a scene that already encloses the node, so a scene that instances
 * itself ends.
 */
export function collapseLiveNode(node: LiveNode, scope: SceneScope, sceneCache: CachedSceneSource): LiveNode {
  let current = node;
  // Advances with the chain: after a merge the `instance` ref is the sub-scene
  // root's own and names an id in that file's pool, which the merged node carries.
  let outer = scopeOf(node, scope);
  while (current.instance) {
    const scenePath = resolveInstancePath(current.instance, outer.externalResources);
    const enclosingScenePaths = outer.instancedScenePaths ?? [];
    if (!scenePath || enclosingScenePaths.includes(scenePath)) break;
    const cached = sceneCache.getCached(scenePath);
    if (!cached) break;
    const content = contentScopeOf(cached, [...enclosingScenePaths, scenePath]);
    const merged = mergeInstanceRoot(current, cached, { outer, content });
    if (!merged) break;
    current = merged;
    outer = scopeOf(merged, content);
  }
  return current;
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

/** The root {@link SceneScope} for a path or tree walk: the root scene's own pools. */
const NO_INTERNAL_RESOURCES: readonly TscnInternalResource[] = [];
export function rootScope(ctx: LiveTreeContext): SceneScope {
  return {
    externalResources: ctx.externalResources,
    internalResources: ctx.internalResources ?? NO_INTERNAL_RESOURCES,
  };
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
  if (node.type === GLB_SCENE_ROOT_TYPE && glbCache) {
    const glbPath = (node.properties as Record<string, unknown>).glbPath as string | undefined;
    const object = glbPath ? glbCache.getCached(glbPath) : undefined;
    if (object) {
      return [{ origin: 'glb', children: glbSceneRootChildren(object), scope: own }];
    }
  }

  if (!node.instance) return inlineOnly();

  const scenePath = resolveInstancePath(node.instance, own.externalResources);
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

  // Inline children are authored in the host scene, so they keep the outer scope.
  const groups: LiveChildGroup[] = [];
  if (node.children.length > 0) {
    groups.push({ origin: 'inline', children: node.children, scope: own });
  }
  groups.push({
    origin: 'subscene',
    children: cached.nodes,
    scope: contentScopeOf(cached, [...enclosingScenePaths, scenePath]),
  });
  return groups;
}

/** The collapsed node a `merged` group carries, so a walker merges each instance once. */
function mergedNodeOf(groups: readonly LiveChildGroup[]): LiveNode | undefined {
  return groups[0]?.mergedNode;
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

  const links: LiveChainLink[] = [];
  let candidateGroups: readonly LiveChildGroup[] = [
    { origin: 'inline', children: roots, scope: rootScope(ctx) },
  ];

  for (const segment of segments) {
    let match: LiveNode | undefined;
    let matchScope: SceneScope = rootScope(ctx);
    for (const group of candidateGroups) {
      const found = group.children.find((n) => n.name === segment);
      if (found) {
        match = found;
        matchScope = group.scope;
        break;
      }
    }
    if (!match) return null;
    candidateGroups = liveChildGroups(match, matchScope, ctx.sceneCache, ctx.glbCache);
    links.push({ raw: match, collapsed: mergedNodeOf(candidateGroups) ?? match });
  }

  return links;
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
 * any segment is unresolvable. {@link resolveLiveNode} returns the node alone.
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
 * The node of {@link resolveLiveEntry}: the collapsed node at a path, or `null`. A
 * single-root sub-scene collapses into its instance node (ADR-0013), so the
 * root's own name is not a path segment.
 */
export function resolveLiveNode(
  path: string,
  roots: readonly TscnNode[],
  ctx: LiveTreeContext
): LiveNode | null {
  return resolveLiveEntry(path, roots, ctx)?.node ?? null;
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
