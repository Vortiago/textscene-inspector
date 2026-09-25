/**
 * The live scene tree: one traversal that composes the root nodes, instancing
 * (Instance root merge, ADR-0013) and GLBSceneRoot internals into one node-path
 * space, each sub-scene's refs scoped to its own tables. It walks a snapshot of
 * the loader's caches, so the React consumers re-run it when a sub-scene loads.
 */
import type * as THREE from 'three';
import type { TscnNode, TscnExternalResource, TscnInternalResource } from '../parser/types.js';
import { resolveInstancePath } from '../resources/SubResourceResolver.js';
import { mergeInstanceRoot } from '../resources/mergeInstanceRoot.js';
// Defined in `parser/types` because a grafted node carries one on itself; kept
// exported here, where every walker already reaches for it.
import type { SceneScope } from '../parser/types.js';
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
  getCached: (
    path: string
  ) => (Partial<SceneScope> & { nodes: readonly TscnNode[] }) | null | undefined;
}

/** Read surface for the loader's GLB cache, so the walk can descend into a GLB's internals. */
export interface CachedGlbSource {
  getCached: (path: string) => THREE.Object3D | null | undefined;
}

export interface LiveTreeContext {
  /** The root scene's ExtResources, which its top-level instance refs resolve against. */
  externalResources: readonly TscnExternalResource[];
  sceneCache: CachedSceneSource;
  glbCache?: CachedGlbSource;
}

/** A node in the live tree: its effective (collapsed) identity and its full path. */
export interface LiveTreeEntry {
  node: TscnNode;
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
  scene:
    | { nodes: readonly TscnNode[]; externalResources?: readonly TscnExternalResource[] }
    | null
    | undefined
): CachedSceneSource {
  return { getCached: (p) => (p === path ? scene ?? undefined : undefined) };
}

/**
 * The node as the tree and viewport render it: a single-root `.tscn` instance
 * collapses into its sub-scene root (Instance root merge, ADR-0013). A `.glb` or
 * multi-root instance, a non-instance and a scene not yet cached return unchanged.
 */
export function collapseLiveNode(
  node: TscnNode,
  scope: SceneScope,
  sceneCache: CachedSceneSource
): TscnNode {
  return collapseToFixedPoint(node, scope, sceneCache, (n, cached, authored) =>
    // The whole scope: the merge stamps it onto the host children it grafts,
    // and those name ids of both kinds.
    mergeInstanceRoot(n, cached, authored)
  );
}

/**
 * Collapse an instance chain to a fixed point, not one level. A host override
 * such as `visible = false` on a heading with no `type=` stays in
 * `rawProperties` until a level with a real type re-parses it, so one level
 * loses it. A seen-set on the scene path stops a scene that instances itself.
 */
function collapseToFixedPoint(
  node: TscnNode,
  scope: SceneScope,
  sceneCache: CachedSceneSource,
  merge: (
    n: TscnNode,
    cached: Partial<SceneScope> & { nodes: readonly TscnNode[] },
    authored: SceneScope
  ) => TscnNode | null
): TscnNode {
  let current = node;
  // Advances with the chain: after a merge the `instance` ref is the sub-scene
  // root's own and names an id in that file's pool. The host's scope finds
  // nothing and stops the collapse one level early.
  let currentScope = scope;
  let seen: Set<string> | undefined;
  while (current.instance) {
    const authored = authoredScope(current, currentScope);
    const scenePath = resolveInstancePath(current.instance, authored.externalResources);
    if (!scenePath || seen?.has(scenePath)) return current;
    const cached = sceneCache.getCached(scenePath);
    if (!cached) return current;
    const merged = merge(current, cached, authored);
    if (!merged) return current;
    (seen ??= new Set()).add(scenePath);
    current = merged;
    currentScope = {
      externalResources: cached.externalResources ?? [],
      internalResources: cached.internalResources ?? [],
    };
  }
  return current;
}

/**
 * The scope a node's refs resolve against: the one it was authored in when it
 * is grafted into another scene's content, else its group's scope. Both pools
 * travel, since a grafted node names ids of either kind from its own file.
 */
function authoredScope(node: TscnNode, groupScope: SceneScope): SceneScope {
  return node.authoredScope ?? groupScope;
}

/** A node's live children, paired with the scope those children resolve against. */
interface ChildScope {
  children: readonly TscnNode[];
  scope: SceneScope;
}

/**
 * The root {@link SceneScope} for a path or tree walk. These walkers never read
 * a SubResource id, so the pool is empty. A consumer that needs SubResources
 * calls `liveChildGroups` with a real scope of its own.
 */
const NO_INTERNAL_RESOURCES: readonly TscnInternalResource[] = [];
export function rootScope(ctx: LiveTreeContext): SceneScope {
  return { externalResources: ctx.externalResources, internalResources: NO_INTERNAL_RESOURCES };
}

/**
 * One group of live children. `origin` is the React key namespace. `merged` and
 * `subscene` children resolve in the sub-scene's scope, `inline` and `glb`
 * children in the outer scope.
 */
export interface LiveChildGroup {
  origin: 'merged' | 'inline' | 'subscene' | 'glb';
  children: readonly TscnNode[];
  /** Both pools this group's children resolve their own refs against, as a {@link SceneScope}. */
  scope: SceneScope;
  /**
   * `merged` groups only: the collapsed node the instance became, so a caller
   * skips a second `mergeInstanceRoot` pass. On every other origin the raw
   * node is the effective node.
   */
  mergedNode?: TscnNode;
}

/**
 * What is below a node: one `inline` group for a non-instance, one `merged`
 * group for a single-root instance, `inline` plus `subscene` for a multi-root or
 * GLB instance, and one `glb` group for a GLBSceneRoot. `scope` is the caller's
 * own. A sub-scene's groups read the sub-scene's scope from the cache.
 */
export function liveChildGroups(
  node: TscnNode,
  scope: SceneScope,
  sceneCache: CachedSceneSource,
  glbCache?: CachedGlbSource
): LiveChildGroup[] {
  const inlineOnly = (): LiveChildGroup[] => [
    { origin: 'inline', children: node.children, scope },
  ];

  // GLB nodes carry no instance refs, so they stay in the outer scope.
  if (node.type === GLB_SCENE_ROOT_TYPE && glbCache) {
    const glbPath = (node.properties as Record<string, unknown>).glbPath as string | undefined;
    const object = glbPath ? glbCache.getCached(glbPath) : undefined;
    if (object) {
      return [{ origin: 'glb', children: glbSceneRootChildren(object), scope }];
    }
  }

  if (!node.instance) return inlineOnly();

  const scenePath = resolveInstancePath(node.instance, authoredScope(node, scope).externalResources);
  if (!scenePath) return inlineOnly();

  const cached = sceneCache.getCached(scenePath);
  if (!cached) return inlineOnly();

  // An absent pool reads as empty, never as the caller's: these ids belong to
  // the sub-scene's file.
  const subScope: SceneScope = {
    externalResources: cached.externalResources ?? [],
    internalResources: cached.internalResources ?? [],
  };

  const merged = mergeInstanceRoot(node, cached, scope);
  if (merged) {
    const collapsed = collapseToFixedPoint(merged, subScope, sceneCache, (n, inner, authored) =>
      mergeInstanceRoot(n, inner, authored)
    );
    return [{ origin: 'merged', children: collapsed.children, scope: subScope, mergedNode: collapsed }];
  }

  // Inline children are authored in the host scene, so they keep the outer scope.
  const groups: LiveChildGroup[] = [];
  if (node.children.length > 0) {
    groups.push({ origin: 'inline', children: node.children, scope });
  }
  groups.push({ origin: 'subscene', children: cached.nodes, scope: subScope });
  return groups;
}

/**
 * One link of the resolved chain: the collapsed node at a path segment and the
 * raw node it came from. The raw node's `instance` is the originating instance
 * that the tree's 📦 badge reads. The collapsed node's `instance` is the
 * sub-scene root's own.
 */
interface LiveChainLink {
  raw: TscnNode;
  collapsed: TscnNode;
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
  let candidateGroups: ChildScope[] = [{ children: roots, scope: rootScope(ctx) }];

  for (const segment of segments) {
    let match: TscnNode | undefined;
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
    links.push({
      raw: match,
      collapsed: collapseLiveNode(match, matchScope, ctx.sceneCache),
    });
    candidateGroups = liveChildGroups(match, matchScope, ctx.sceneCache, ctx.glbCache);
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
): TscnNode[] | null {
  const links = liveChainLinks(path, roots, ctx);
  return links ? links.map((l) => l.collapsed) : null;
}

export interface ResolvedLiveNode {
  /** The collapsed node, the identity the tree and viewport render. */
  node: TscnNode;
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
): TscnNode | null {
  return resolveLiveEntry(path, roots, ctx)?.node ?? null;
}

/** Guards against a cyclic cache, which Godot's editor forbids authoring. Real scenes nest a few levels. */
const MAX_DEPTH = 100;

/** Depth-first walk of the live tree, calling `visit` with each collapsed node and its full path. */
export function walkLiveTree(
  roots: readonly TscnNode[],
  ctx: LiveTreeContext,
  visit: (entry: LiveTreeEntry) => void,
  descend?: (node: TscnNode) => boolean
): void {
  const walk = (
    nodes: readonly TscnNode[],
    scope: SceneScope,
    parentPath: string,
    depth: number
  ): void => {
    if (depth > MAX_DEPTH) return;
    for (const node of nodes) {
      const path = joinPath(parentPath, node.name);
      const effective = collapseLiveNode(node, scope, ctx.sceneCache);
      visit({ node: effective, path });
      // `descend` prunes only the children, so a consumer can count a boundary
      // without counting what is behind it.
      if (descend && !descend(effective)) continue;
      const groups = liveChildGroups(node, scope, ctx.sceneCache, ctx.glbCache);
      for (const group of groups) {
        walk(group.children, group.scope, path, depth + 1);
      }
    }
  };
  walk(roots, rootScope(ctx), '', 0);
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
  predicate: (node: TscnNode) => boolean,
  descend?: (node: TscnNode) => boolean
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
