/**
 * The **live scene tree** — one traversal that composes the SceneGraph's root
 * Nodes with PackedScene instancing (Instance root merge, ADR-0013, plus
 * lazily-loaded sub-scenes) and GLBSceneRoot internals into a single, consistent
 * node-path space, scoping each sub-scene's ExtResource refs to ITS own resource
 * table.
 *
 * This is the shared definition the inspector resolver, the cameras/stats panels
 * (and, over time, the tree + viewport walkers) read from, instead of each
 * re-deriving merge/scope/GLB-descent/path rules — the recurring source of the
 * "node inside an instance is invisible" class of bug. It is pure and
 * React-free: it walks a CACHE SNAPSHOT (the loader's scene + GLB caches), so
 * reactivity (re-running when a sub-scene loads) belongs to the React consumers,
 * not here.
 */
import type * as THREE from 'three';
import type { TscnNode, TscnExternalResource } from '../parser/types.js';
import { resolveInstancePath } from '../resources/SubResourceResolver.js';
import { mergeInstanceRoot } from '../resources/mergeInstanceRoot.js';
import { GLB_SCENE_ROOT_TYPE } from './internal/glb-scene-root/Component.js';
import { glbSceneRootChildren } from './internal/glb-scene-root/glbHierarchy.js';
import { joinPath } from '../utils/nodePath.js';

/**
 * Read surface for the loader's PackedScene cache. `undefined` = never
 * requested, `null` = previously failed, value = loaded (with its own resources).
 */
export interface CachedSceneSource {
  getCached: (
    path: string
  ) =>
    | { nodes: readonly TscnNode[]; externalResources?: readonly TscnExternalResource[] }
    | null
    | undefined;
}

/** Read surface for the loader's GLB cache — lets the walk descend into a GLB's internals. */
export interface CachedGlbSource {
  getCached: (path: string) => THREE.Object3D | null | undefined;
}

/** Everything the walk needs: the root scope + the loader cache snapshots. */
export interface LiveTreeContext {
  /** The root scene's ExtResources — the scope its top-level instance refs resolve against. */
  externalResources: readonly TscnExternalResource[];
  sceneCache: CachedSceneSource;
  glbCache?: CachedGlbSource;
}

/** A node in the live tree: its effective (collapsed) identity + its full path. */
export interface LiveTreeEntry {
  node: TscnNode;
  path: string;
}

/**
 * A {@link CachedSceneSource} that answers for exactly ONE path — the way the
 * React walkers (tree `TreeNode`, viewport `InstancedNode`) hand the core the
 * single sub-scene they just loaded so the shared `collapseLiveNode` decides the
 * Instance root merge instead of each re-deriving it. Keying by path keeps every
 * mount's scope to itself (ADR-0009): a query for any other path (a sibling
 * instance) returns `undefined`, never leaking this scene. A `null`/`undefined`
 * scene (still loading / failed) reads as not-cached, so the collapse keeps the
 * node until the load lands.
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
 * The node as the tree/viewport render it: a single-root `.tscn` instance
 * COLLAPSES into its sub-scene root (Instance root merge, ADR-0013), adopting
 * the root's type/properties/children. `.glb`/multi-root instances (and
 * non-instances, or not-yet-cached scenes) are returned unchanged.
 */
export function collapseLiveNode(
  node: TscnNode,
  externalResources: readonly TscnExternalResource[],
  sceneCache: CachedSceneSource
): TscnNode {
  if (!node.instance) return node;
  const scenePath = resolveInstancePath(node.instance, externalResources);
  if (!scenePath) return node;
  const cached = sceneCache.getCached(scenePath);
  if (!cached) return node;
  return mergeInstanceRoot(node, cached) ?? node;
}

/** A node's live children, paired with the ExtResource scope those children resolve against. */
interface ChildScope {
  children: readonly TscnNode[];
  externalResources: readonly TscnExternalResource[];
}

/**
 * The single source of truth for "what is below this node, and in what resource
 * scope". For an instance node the scope is the LOADED sub-scene's own resource
 * table — a nested instance references its parent sub-scene's ExtResources,
 * absent from the outer scene, so descent must switch scope. GLB / non-instance
 * children keep the incoming scope.
 */
export function liveChildren(
  node: TscnNode,
  externalResources: readonly TscnExternalResource[],
  sceneCache: CachedSceneSource,
  glbCache?: CachedGlbSource
): ChildScope {
  const inline = node.children;
  const keep = (children: readonly TscnNode[]): ChildScope => ({ children, externalResources });

  // GLBSceneRoot: its children are the loaded GLB's internal nodes (+ a synthetic
  // AnimationPlayer when it has clips). No instance refs of their own.
  if (node.type === GLB_SCENE_ROOT_TYPE && glbCache) {
    const glbPath = (node.properties as Record<string, unknown>).glbPath as string | undefined;
    const object = glbPath ? glbCache.getCached(glbPath) : undefined;
    if (object) return keep(glbSceneRootChildren(object));
  }

  if (!node.instance) return keep(inline);

  const scenePath = resolveInstancePath(node.instance, externalResources);
  if (!scenePath) return keep(inline);

  const cached = sceneCache.getCached(scenePath);
  if (!cached) return keep(inline);

  const subResources = cached.externalResources ?? [];

  // Collapsed single-root instance: descend into the merged children (root's
  // children first, then host-added).
  const merged = mergeInstanceRoot(node, cached);
  if (merged) return { children: merged.children, externalResources: subResources };

  // Fallback (GLB / multi-root): inline children first, then the loaded roots —
  // matching the tree's hierarchy.
  return {
    children: inline.length > 0 ? [...inline, ...cached.nodes] : cached.nodes,
    externalResources: subResources,
  };
}

/**
 * Resolve a slash-joined path to the chain of EFFECTIVE (collapsed) nodes from
 * the root down to the target — descending into sub-scenes (Instance root merge,
 * ADR-0013) and GLB internals, switching resource scope per sub-scene. Returns
 * `null` if any segment is unresolvable. Each element is the COLLAPSED node at
 * that level, so an ancestor-transform walk (e.g. `node2dWorldPosition`) sees an
 * instance node's merged properties rather than the redundant wrapper root.
 */
export function liveNodeChain(
  path: string,
  roots: readonly TscnNode[],
  ctx: LiveTreeContext
): TscnNode[] | null {
  const segments = path.split('/').filter((s) => s.length > 0);
  if (segments.length === 0) return null;

  const chain: TscnNode[] = [];
  let candidates: readonly TscnNode[] = roots;
  let candidatesResources = ctx.externalResources;

  for (const segment of segments) {
    const match = candidates.find((n) => n.name === segment);
    if (!match) return null;
    // The collapsed node uses the scope it lives in (its parent's child scope).
    chain.push(collapseLiveNode(match, candidatesResources, ctx.sceneCache));
    const next = liveChildren(match, candidatesResources, ctx.sceneCache, ctx.glbCache);
    candidates = next.children;
    candidatesResources = next.externalResources;
  }

  return chain;
}

/**
 * The effective (collapsed) node at a slash-joined path, or `null` if any
 * segment is unresolvable. A single-root sub-scene collapses into its instance
 * node (ADR-0013), so the root's own name is NOT a path segment. Thin wrapper
 * over {@link liveNodeChain} — the last link of the same walk.
 */
export function resolveLiveNode(
  path: string,
  roots: readonly TscnNode[],
  ctx: LiveTreeContext
): TscnNode | null {
  const chain = liveNodeChain(path, roots, ctx);
  return chain && chain.length > 0 ? chain[chain.length - 1]! : null;
}

/**
 * Defensive cap on descent depth. Real scenes nest only a handful of instance
 * levels (plus GLB skeletons); this only guards against a pathological cyclic
 * cache, which Godot's editor forbids authoring.
 */
const MAX_DEPTH = 100;

/**
 * Depth-first walk of the entire live tree, invoking `visit` with each node's
 * effective identity and full path. The building block for enumeration adapters
 * (cameras, stats, search).
 */
export function walkLiveTree(
  roots: readonly TscnNode[],
  ctx: LiveTreeContext,
  visit: (entry: LiveTreeEntry) => void
): void {
  const walk = (
    nodes: readonly TscnNode[],
    scope: readonly TscnExternalResource[],
    parentPath: string,
    depth: number
  ): void => {
    if (depth > MAX_DEPTH) return;
    for (const node of nodes) {
      const path = joinPath(parentPath, node.name);
      visit({ node: collapseLiveNode(node, scope, ctx.sceneCache), path });
      const next = liveChildren(node, scope, ctx.sceneCache, ctx.glbCache);
      walk(next.children, next.externalResources, path, depth + 1);
    }
  };
  walk(roots, ctx.externalResources, '', 0);
}

/**
 * Every live-tree node whose effective identity satisfies `predicate`, with its
 * path. Replaces `flattenedNodes.filter(...)` for consumers that must see
 * sub-scene + GLB content (e.g. the cameras panel, node counts).
 */
export function collectLiveNodes(
  roots: readonly TscnNode[],
  ctx: LiveTreeContext,
  predicate: (node: TscnNode) => boolean
): LiveTreeEntry[] {
  const out: LiveTreeEntry[] = [];
  walkLiveTree(roots, ctx, (entry) => {
    if (predicate(entry.node)) out.push(entry);
  });
  return out;
}
