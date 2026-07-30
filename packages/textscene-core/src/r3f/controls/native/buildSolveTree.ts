/**
 * `useBuildSolveTree` — the live-tree walker that turns a Control subtree
 * into the `SolveNode` forest `controlRectSolver.ts` consumes. Built on
 * `liveSceneTree.ts`'s shared traversal (`liveChildGroups`) rather than
 * re-deriving PackedScene-instancing/GLB-descent/per-sub-scene-scope rules —
 * the "node inside an instance is invisible" bug class that module exists to
 * kill.
 *
 * A non-Control ancestor (a `Node3D` housing an instanced HUD, or the raw
 * `Node` an unresolved/multi-root instance parses as) contributes no
 * `SolveNode` of its own: it is transparently skipped and its own children
 * are walked in its place, exactly like the DOM overlay's `GenericControlFallback`
 * (`display: contents`) never becomes a CSS containing block. Without this a
 * non-Control node would still get a rect from the solver (anchors/offsets
 * default to zero for a type that never authors them), and any REAL Control
 * nested under it would then anchor against that degenerate zero-sized rect
 * instead of the viewport — silently wrong sizing, not a crash. `TWO_D_UI_TYPES`
 * (`has2DUIContent.ts`) is the existing mirror of "which types are genuinely
 * Control-ish"; this module reads it rather than keeping a second list.
 *
 * `generation` bumps whenever ANY scene or texture load/failure lands on the
 * bus. A plain `useMemo` over `[nodes, externalResources, internalResources]`
 * cannot see a sub-scene arriving in the loader's cache later — the cache is
 * a mutable snapshot outside React's dependency graph — so `generation` is
 * the seam that makes a later arrival force a re-walk.
 */

import { useEffect, useMemo, useState } from 'react';
import * as THREE from 'three';
import type {
  TscnExternalResource,
  TscnInternalResource,
  TscnNode,
  TscnScene,
} from '../../../parser/types';
import type { ControlProperties } from '../../../nodes/2d/ui/control/types';
import { joinPath } from '../../../utils/nodePath';
import { resolveExtResourcePath, resolveInstancePath } from '../../../resources/SubResourceResolver';
import { useResourceLoader } from '../../../resources/useResource';
import type { ResourceLoader } from '../../../resources/ResourceLoader';
import { liveChildGroups, type CachedSceneSource } from '../../liveSceneTree';
import { isViewportBoundary } from '../../../nodes/viewport/subviewport/viewportBoundary';
import { TWO_D_UI_TYPES } from '../has2DUIContent';
import type { SolveNode } from './solveTree';
import type { StyleBoxFlatData } from './styleBoxFlat';
import { parseStyleBox } from './parseStyleBox';
import type { Vec2 } from './rect';

export interface UseBuildSolveTreeResult {
  /** Top-level Control roots — real scene roots AND any promoted up through a skipped non-Control ancestor. */
  tree: readonly SolveNode[];
  /** Bumps on every scene/texture load or failure; a stable dep for a consumer's own memoisation. */
  generation: number;
}

/** A `CachedSceneSource` whose cache actually holds the full `TscnScene` (nodes + BOTH resource pools). */
interface SceneSourceWithResources extends CachedSceneSource {
  getCached(path: string): TscnScene | null | undefined;
}

const EMPTY_SCENE_CACHE: SceneSourceWithResources = { getCached: () => undefined };
const NO_TEXTURE_CACHE = { getCached: (): THREE.Texture | null | undefined => undefined };

/**
 * Resolve every `theme_override_styles/*` ref on a node, IN ITS OWN SCOPE —
 * `internalResources` is already the collapsed node's own scope by the time
 * `walk` calls this (a sub-scene's SubResource pool for a merged/subscene
 * node, the outer pool otherwise). `parseStyleBox` degrades to `null` for an
 * absent/malformed/non-StyleBoxFlat ref, which this simply omits from the
 * result rather than fabricating a fallback stylebox.
 */
function resolveStyleBoxes(
  node: TscnNode,
  internalResources: readonly TscnInternalResource[]
): Readonly<Record<string, StyleBoxFlatData>> {
  const overrides = (node.properties as ControlProperties).themeOverrideStyles;
  if (!overrides) return {};
  const out: Record<string, StyleBoxFlatData> = {};
  for (const [key, ref] of Object.entries(overrides)) {
    const resolved = parseStyleBox(ref, internalResources);
    if (resolved) out[key] = resolved;
  }
  return out;
}

interface ForestResult {
  tree: SolveNode[];
  pendingScenes: string[];
  pendingTextures: string[];
}

/**
 * Builds the SolveNode forest for one (nodes, resource-scope) pair. Not a
 * hook itself — `useBuildSolveTree` is the only React-facing surface — so it
 * stays trivially testable and reusable if a future non-React consumer needs
 * the same walk (e.g. a headless render-to-texture pass).
 */
function buildForest(
  nodes: readonly TscnNode[],
  externalResources: readonly TscnExternalResource[],
  internalResources: readonly TscnInternalResource[],
  loader: ResourceLoader | null
): ForestResult {
  const pendingScenes = new Set<string>();
  const pendingTextures = new Set<string>();

  const sceneCache: SceneSourceWithResources = loader
    ? { getCached: (p: string) => loader.scenes.getCached(p) }
    : EMPTY_SCENE_CACHE;
  const textureCache = loader ? { getCached: (p: string) => loader.textures.getCached(p) } : NO_TEXTURE_CACHE;

  function resolveTextureSize(node: TscnNode, ext: readonly TscnExternalResource[]): Vec2 | null {
    const ref = (node.properties as Record<string, unknown>).texture;
    if (typeof ref !== 'string' || ref === '') return null;
    const path = resolveExtResourcePath(ref, ext);
    if (!path) return null;
    const cached = textureCache.getCached(path);
    if (cached === undefined) {
      pendingTextures.add(path);
      return null;
    }
    if (cached === null) return null;
    const image = cached.image as { width?: number; height?: number } | undefined;
    return { x: image?.width ?? 0, y: image?.height ?? 0 };
  }

  function walk(
    list: readonly TscnNode[],
    parentPath: string,
    ext: readonly TscnExternalResource[],
    int: readonly TscnInternalResource[]
  ): SolveNode[] {
    const out: SolveNode[] = [];
    for (const node of list) {
      // A SubViewport owns its own World2D (ADR-0030); its Control subtree is
      // drawn by its own viewport surface, never by the enclosing canvas.
      if (isViewportBoundary(node.type)) continue;

      const path = joinPath(parentPath, node.name);

      const scenePath = node.instance ? resolveInstancePath(node.instance, ext) : null;
      const cachedScene = scenePath ? sceneCache.getCached(scenePath) : undefined;
      if (scenePath && cachedScene === undefined) pendingScenes.add(scenePath);

      const groups = liveChildGroups(node, ext, sceneCache);
      const mergedGroup = groups.find((g) => g.origin === 'merged');
      const collapsed = mergedGroup?.mergedNode ?? node;

      const ownExternal = mergedGroup ? mergedGroup.externalResources : ext;
      const ownInternal = mergedGroup ? cachedScene?.internalResources ?? [] : int;

      const children = groups.flatMap((g) => {
        const groupInternal =
          g.origin === 'merged' || g.origin === 'subscene' ? cachedScene?.internalResources ?? [] : int;
        return walk(g.children, path, g.externalResources, groupInternal);
      });

      if (TWO_D_UI_TYPES.has(collapsed.type)) {
        out.push({
          path,
          node: collapsed,
          children,
          styleBoxes: resolveStyleBoxes(collapsed, ownInternal),
          textureSize: resolveTextureSize(collapsed, ownExternal),
        });
      } else {
        // Not a genuine Control type — transparent passthrough (see module doc):
        // no SolveNode of its own, its Control descendants promote up instead.
        out.push(...children);
      }
    }
    return out;
  }

  const tree = walk(nodes, '', externalResources, internalResources);
  return { tree, pendingScenes: [...pendingScenes], pendingTextures: [...pendingTextures] };
}

export function useBuildSolveTree(
  nodes: readonly TscnNode[],
  externalResources: readonly TscnExternalResource[],
  internalResources: readonly TscnInternalResource[]
): UseBuildSolveTreeResult {
  const loader = useResourceLoader();
  const [generation, setGeneration] = useState(0);

  useEffect(() => {
    if (!loader) return undefined;
    const bump = () => setGeneration((g) => g + 1);
    loader.eventBus.on('scene', 'loaded', bump);
    loader.eventBus.on('scene', 'failed', bump);
    loader.eventBus.on('texture', 'loaded', bump);
    loader.eventBus.on('texture', 'failed', bump);
    return () => {
      loader.eventBus.off('scene', 'loaded', bump);
      loader.eventBus.off('scene', 'failed', bump);
      loader.eventBus.off('texture', 'loaded', bump);
      loader.eventBus.off('texture', 'failed', bump);
    };
  }, [loader]);

  const { tree, pendingScenes, pendingTextures } = useMemo(
    () => buildForest(nodes, externalResources, internalResources, loader),
    // `generation` is an intentional cache-buster: it increments each time a
    // scene/texture load or failure lands so the walk re-derives against the
    // loader's now-different cache snapshot. Its value is not read inside the
    // callback — mirrors `useLiveSceneTree.ts`'s identical `version` pattern.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [nodes, externalResources, internalResources, loader, generation]
  );

  // Kick off loads for anything the walk found uncached — after render, not
  // during it, matching `useResource`'s own request-in-effect convention.
  useEffect(() => {
    if (!loader) return;
    for (const path of pendingScenes) loader.scenes.request(path);
    for (const path of pendingTextures) loader.textures.request(path);
  }, [loader, pendingScenes, pendingTextures]);

  return { tree, generation };
}
