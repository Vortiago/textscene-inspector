/**
 * The **live scene tree** — one traversal that composes the SceneGraph's root
 * Nodes with PackedScene instancing (Instance root merge, ADR-0013, plus
 * lazily-loaded sub-scenes) and GLBSceneRoot internals into a single, consistent
 * node-path space, scoping each sub-scene's ExtResource AND SubResource refs to
 * ITS own resource tables.
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
import type { TscnNode, TscnExternalResource, TscnInternalResource } from '../parser/types.js';
import { resolveInstancePath } from '../resources/SubResourceResolver.js';
import { mergeInstanceRoot } from '../resources/mergeInstanceRoot.js';
import { GLB_SCENE_ROOT_TYPE } from './internal/glb-scene-root/Component.js';
import { glbSceneRootChildren } from './internal/glb-scene-root/glbHierarchy.js';
import { joinPath } from '../utils/nodePath.js';

/**
 * The resource scope a subtree resolves its ids against — BOTH pools, always
 * together.
 *
 * They travel as one value rather than two parameters because a `.tscn`'s ids
 * are per-file and per-KIND: a node can name `ExtResource("2")` and
 * `SubResource("1")` in the same property block, and both mean "in the scene I
 * was authored in". Splitting them lets a caller pass one and forget the other,
 * which resolves half the ids against the right scene and half against nothing
 * — a StyleBox that silently comes back `undefined` while the textures beside
 * it load fine. That is not hypothetical: while these were separate parameters
 * (one required, one optional), BOTH consumers that needed the SubResource pool
 * shipped call sites that compiled, ran, and passed their full suites with it
 * omitted. One type makes the omission unrepresentable instead of untested.
 */
export interface SceneScope {
  readonly externalResources: readonly TscnExternalResource[];
  readonly internalResources: readonly TscnInternalResource[];
}

/**
 * Read surface for the loader's PackedScene cache. `undefined` = never
 * requested, `null` = previously failed, value = loaded, carrying whichever of
 * its own pools the cache holds.
 *
 * The pools stay OPTIONAL here, unlike on {@link SceneScope}, because this is a
 * READ surface a test or a narrow caller implements — `ResourceLoader.scenes`
 * returns a full `TscnScene` and satisfies it completely, while a stub that
 * answers with nodes alone is still a legitimate cache. An absent pool here
 * means "this cache does not know", which the walk resolves to an empty scope;
 * an absent pool on `SceneScope` would mean "I forgot", which is why that one
 * admits no such thing.
 */
export interface CachedSceneSource {
  getCached: (
    path: string
  ) => (Partial<SceneScope> & { nodes: readonly TscnNode[] }) | null | undefined;
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

/** A node's live children, paired with the scope those children resolve against. */
interface ChildScope {
  children: readonly TscnNode[];
  scope: SceneScope;
}

/**
 * The root {@link SceneScope} for a path/tree walk.
 *
 * These walkers resolve node paths and collapse instances; they never read a
 * SubResource id, so `LiveTreeContext` carries no such pool and this states
 * that explicitly rather than implying one exists. A consumer that DOES need
 * SubResources (StyleBox resolution) does not come through here — it calls
 * `liveChildGroups` with a real scope of its own.
 */
const NO_INTERNAL_RESOURCES: readonly TscnInternalResource[] = [];
function rootScope(ctx: LiveTreeContext): SceneScope {
  return { externalResources: ctx.externalResources, internalResources: NO_INTERNAL_RESOURCES };
}

/**
 * One origin-tagged group of live children. The origin is the React key
 * namespace (`merged`/`inline`/`subscene`/`glb`) and the authoritative
 * record of which resource scope its children resolve against — BOTH pools:
 * `externalResources` for a nested instance ref, `internalResources` for a
 * StyleBox/other SubResource authored in that same scope.
 *
 * - `merged`   — collapsed single-root instance; children from merged node; sub-scene scope.
 * - `inline`   — host-authored children of an instance node; OUTER scope.
 * - `subscene` — loaded roots of a fallback (multi-root / GLB) instance; sub-scene scope.
 * - `glb`      — synthetic nodes from a GLBSceneRoot's loaded GLB; OUTER scope.
 */
export interface LiveChildGroup {
  origin: 'merged' | 'inline' | 'subscene' | 'glb';
  children: readonly TscnNode[];
  /** Both pools this group's children resolve their own refs against — see {@link SceneScope}. */
  scope: SceneScope;
  /**
   * `origin: 'merged'` groups only: the collapsed root node the instance became
   * (Instance root merge, ADR-0013) — the effective identity the tree row and
   * inspector render. Carried here so a caller that already built the groups
   * derives the collapsed node without a second `mergeInstanceRoot` pass.
   * Absent on every other origin, whose effective node is the raw node itself.
   */
  mergedNode?: TscnNode;
}

/**
 * The single origin-tagged source of truth for "what is below this node, and
 * in what ExtResource scope". Each group carries the scope its children resolve
 * their own instance refs against:
 *
 * - Non-instance node → one `inline` group (OUTER scope).
 * - Collapsed single-root instance (ADR-0013) → one `merged` group (sub-scene scope).
 * - Fallback (multi-root / GLB instance) → an `inline` group (OUTER scope, for
 *   host-authored children) + a `subscene` group (sub-scene scope, for loaded roots).
 *   The split matters: inline children are authored in the OUTER scene and must
 *   resolve against OUTER resources, not the sub-scene scope of the loaded roots.
 * - GLBSceneRoot → one `glb` group (OUTER scope — GLB nodes carry no instance refs).
 *
 * The tree and viewport walkers map these groups directly to get per-group scope
 * without re-computing the branch.
 *
 * `scope` is the CALLER's own scope — what a host-authored (`inline`/`glb`)
 * group's children resolve against. A sub-scene's groups get the sub-scene's
 * own scope instead, read from the cache.
 */
export function liveChildGroups(
  node: TscnNode,
  scope: SceneScope,
  sceneCache: CachedSceneSource,
  glbCache?: CachedGlbSource
): LiveChildGroup[] {
  // A node's own authored children in the incoming (OUTER) scope — the answer
  // for every non-instance case and every not-(yet-)resolvable instance case.
  const inlineOnly = (): LiveChildGroup[] => [
    { origin: 'inline', children: node.children, scope },
  ];

  // GLBSceneRoot: its children are the loaded GLB's internal nodes. No instance
  // refs of their own; they live in the OUTER scope.
  if (node.type === GLB_SCENE_ROOT_TYPE && glbCache) {
    const glbPath = (node.properties as Record<string, unknown>).glbPath as string | undefined;
    const object = glbPath ? glbCache.getCached(glbPath) : undefined;
    if (object) {
      return [{ origin: 'glb', children: glbSceneRootChildren(object), scope }];
    }
  }

  if (!node.instance) return inlineOnly();

  const scenePath = resolveInstancePath(node.instance, scope.externalResources);
  if (!scenePath) return inlineOnly();

  const cached = sceneCache.getCached(scenePath);
  if (!cached) return inlineOnly();

  // An absent pool on the CACHE means "this cache does not track it" (see
  // `CachedSceneSource`), which is an empty scope — not the caller's, since
  // these ids belong to the sub-scene's file.
  const subScope: SceneScope = {
    externalResources: cached.externalResources ?? [],
    internalResources: cached.internalResources ?? [],
  };

  // Collapsed single-root instance (ADR-0013): one merged group under sub-scene
  // scope. The merged node rides along on the group so a caller needing the
  // collapsed identity (the tree row) reuses this merge instead of re-running it.
  const merged = mergeInstanceRoot(node, cached);
  if (merged) {
    return [{ origin: 'merged', children: merged.children, scope: subScope, mergedNode: merged }];
  }

  // Fallback (multi-root / GLB instance): inline children stay in OUTER scope;
  // the loaded sub-scene roots go in sub-scene scope. This is the correct split —
  // inline children are authored in the host scene and resolve against its resources.
  const groups: LiveChildGroup[] = [];
  if (node.children.length > 0) {
    groups.push({ origin: 'inline', children: node.children, scope });
  }
  groups.push({ origin: 'subscene', children: cached.nodes, scope: subScope });
  return groups;
}

/**
 * One link of the resolved chain: the EFFECTIVE (collapsed) node at a path
 * segment, paired with the RAW node it was resolved from. The raw node's own
 * `instance` ref is the ORIGINATING instance — what the tree's 📦 badge keys
 * off — distinct from the collapsed node's `instance` (the sub-scene root's,
 * carried for nested-root re-dispatch and `undefined` for a plain root).
 */
interface LiveChainLink {
  raw: TscnNode;
  collapsed: TscnNode;
}

/**
 * The single segment-walk both {@link liveNodeChain} and {@link resolveLiveEntry}
 * read from: descend a slash-joined path, collapsing each segment and switching
 * resource scope per sub-scene, capturing the raw + collapsed node at each level.
 * Returns `null` if any segment is unresolvable.
 *
 * Uses `liveChildGroups` directly (rather than a single flattened child list) so
 * that in the multi-group fallback case — where inline children carry OUTER scope
 * and sub-scene roots carry sub-scene scope — the walk picks up the correct scope
 * for the matched node's own descent instead of defaulting to the first group's scope.
 */
function liveChainLinks(
  path: string,
  roots: readonly TscnNode[],
  ctx: LiveTreeContext
): LiveChainLink[] | null {
  const segments = path.split('/').filter((s) => s.length > 0);
  if (segments.length === 0) return null;

  const links: LiveChainLink[] = [];
  // Seed: the root-level candidates are in a single implicit inline group.
  let candidateGroups: ChildScope[] = [{ children: roots, scope: rootScope(ctx) }];

  for (const segment of segments) {
    // Find the segment in any of the current candidate groups, tracking which
    // group it was found in so we inherit that group's scope for collapse + descent.
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
    // The collapsed node uses the scope it lives in (its own group's scope).
    links.push({
      raw: match,
      collapsed: collapseLiveNode(match, matchScope.externalResources, ctx.sceneCache),
    });
    // Descend: use liveChildGroups so each next-level group carries the right scope.
    candidateGroups = liveChildGroups(match, matchScope, ctx.sceneCache, ctx.glbCache);
  }

  return links;
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
  const links = liveChainLinks(path, roots, ctx);
  return links ? links.map((l) => l.collapsed) : null;
}

/** The effective node at a path plus its originating instance ref. */
export interface ResolvedLiveNode {
  /** The EFFECTIVE (collapsed) node — the identity the tree/viewport render. */
  node: TscnNode;
  /**
   * The selected node's OWN (pre-collapse) `instance` ref, or `undefined` for a
   * non-instance node. Drives the inspector's 📦 external-scene indicator the
   * same way the tree row does — the collapsed `node.instance` is the sub-scene
   * root's ref, so it can't carry this.
   */
  instanceRef: string | undefined;
}

/**
 * The effective node at a slash-joined path together with its originating
 * instance ref, or `null` if any segment is unresolvable. The richer sibling of
 * {@link resolveLiveNode} for the inspector, which must show both the collapsed
 * identity AND whether the node is an instanced external scene.
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
 * The effective (collapsed) node at a slash-joined path, or `null` if any
 * segment is unresolvable. A single-root sub-scene collapses into its instance
 * node (ADR-0013), so the root's own name is NOT a path segment. The node-only
 * view of {@link resolveLiveEntry} — the last link of the same walk.
 */
export function resolveLiveNode(
  path: string,
  roots: readonly TscnNode[],
  ctx: LiveTreeContext
): TscnNode | null {
  return resolveLiveEntry(path, roots, ctx)?.node ?? null;
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
 *
 * Uses `liveChildGroups` per node so each child group's correct scope is
 * threaded into the recursive descent — the fallback (multi-root / GLB instance)
 * case has inline children in OUTER scope and sub-scene roots in sub-scene scope,
 * and the walk must respect that split.
 */
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
      const effective = collapseLiveNode(node, scope.externalResources, ctx.sceneCache);
      visit({ node: effective, path });
      // The node itself is always visited; `descend` only prunes its CHILDREN,
      // so a consumer can count a boundary without counting what is behind it.
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
 * Every live-tree node whose effective identity satisfies `predicate`, with its
 * path. Replaces `flattenedNodes.filter(...)` for consumers that must see
 * sub-scene + GLB content (e.g. the cameras panel, node counts).
 *
 * `descend` prunes the walk: return false for a node whose CHILDREN should not
 * be collected (the node itself is still visited). It exists because "what is in
 * the tree" and "what is in THIS view" are different questions — a sub-viewport's
 * content is visible only through its surface, so the 2D-content hint stops
 * there while the scene tree panel does not.
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
