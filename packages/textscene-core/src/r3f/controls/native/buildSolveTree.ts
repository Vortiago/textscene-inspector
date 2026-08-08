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
 * are walked in its place — it is transparent to layout, never a box its
 * descendants resolve against. Without this a
 * non-Control node would still get a rect from the solver (anchors/offsets
 * default to zero for a type that never authors them), and any REAL Control
 * nested under it would then anchor against that degenerate zero-sized rect
 * instead of the viewport — silently wrong sizing, not a crash. `TWO_D_UI_TYPES`
 * (`has2DUIContent.ts`) is the existing mirror of "which types are genuinely
 * Control-ish"; this module reads it rather than keeping a second list.
 *
 * `generation` bumps whenever ANY scene/texture/theme/font-resource
 * load/failure lands on the bus, OR a runtime scene-font metrics load settles
 * (`text/sceneFontLoader.ts`'s `onSceneFontMetricsSettled` — the SAME
 * mechanism, a second listener source rather than a second one: that module's
 * `peekSceneFontMetrics` answers synchronously with the bundled fallback
 * while a real font is still loading, so the FIRST solve after a scene font
 * appears necessarily under-shapes text against it; this bump is what makes
 * the solve rerun once the real metrics land). A plain `useMemo` over
 * `[nodes, externalResources, internalResources]` cannot see either kind of
 * arrival — both are mutable caches outside React's dependency graph — so
 * `generation` is the seam that makes a later arrival force a re-walk.
 */

import { useEffect, useMemo, useState } from 'react';
import * as THREE from 'three';
import type { TscnExternalResource, TscnInternalResource, TscnNode } from '../../../parser/types';
import type { ControlProperties } from '../../../nodes/2d/ui/control/types';
import { joinPath } from '../../../utils/nodePath';
import {
  findSubResource,
  parseResourceReference,
  resolveInstancePath,
  resolveTexture2DPath,
} from '../../../resources/SubResourceResolver';
import { useResourceLoader } from '../../../resources/useResource';
import { inlineTexture2DSize } from '../../../resources/useTexture2D';
import type { ResourceLoader } from '../../../resources/ResourceLoader';
import type { FontResource } from '../../../resources/processing/fontProcessing';
import {
  resolveInlineFontResource,
  resolveInlineThemeResource,
  type FontCacheReader,
  type ThemeResource,
} from '../../../resources/processing/themeProcessing';
import { onSceneFontMetricsSettled } from './text/sceneFontLoader';
import { useProjectSettings } from '../../contexts/ProjectSettingsContext';
import { liveChildGroups, type CachedSceneSource, type SceneScope } from '../../liveSceneTree';
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

const EMPTY_SCENE_CACHE: CachedSceneSource = { getCached: () => undefined };
const NO_TEXTURE_CACHE = { getCached: (): THREE.Texture | null | undefined => undefined };
const NO_THEME_CACHE = { getCached: (): ThemeResource | null | undefined => undefined };
const NO_FONT_CACHE: FontCacheReader = { getCached: (): FontResource | null | undefined => undefined };

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
  pendingThemes: string[];
  pendingFonts: string[];
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
  loader: ResourceLoader | null,
  projectThemeRef: string | undefined
): ForestResult {
  const pendingScenes = new Set<string>();
  const pendingTextures = new Set<string>();
  const pendingThemes = new Set<string>();
  const pendingFonts = new Set<string>();

  const sceneCache: CachedSceneSource = loader
    ? { getCached: (p: string) => loader.scenes.getCached(p) }
    : EMPTY_SCENE_CACHE;
  const textureCache = loader ? { getCached: (p: string) => loader.textures.getCached(p) } : NO_TEXTURE_CACHE;
  const themeCache = loader ? { getCached: (p: string) => loader.themes.getCached(p) } : NO_THEME_CACHE;
  const fontCache: FontCacheReader = loader ? { getCached: (p: string) => loader.fonts.getCached(p) } : NO_FONT_CACHE;

  /**
   * Resolve a Control's own `theme = ExtResource(...)`/`SubResource(...)` —
   * `Control::get_theme()` (`scene/gui/control.h`). An ExtResource routes
   * through `loader.themes` (cache-read + pending, mirroring
   * `resolveTextureSize`); a SubResource addresses a Theme declared INLINE in
   * this scene, decoded synchronously via `resolveInlineThemeResource` — a
   * `res://scene.tscn::id` address could never resolve through `loader.themes`
   * (`parseTresFile` requires a `[gd_resource]` header; a scene's own
   * `[gd_scene]` header throws), so it is never attempted.
   */
  function resolveOwnTheme(
    themeRef: string | undefined,
    ext: readonly TscnExternalResource[],
    int: readonly TscnInternalResource[]
  ): ThemeResource | null {
    if (!themeRef) return null;
    const parsed = parseResourceReference(themeRef);
    if (!parsed) return null;

    if (parsed.type === 'ExtResource') {
      const path = ext.find((r) => r.id === parsed.id)?.path;
      if (!path) return null;
      const cached = themeCache.getCached(path);
      if (cached === undefined) {
        pendingThemes.add(path);
        return null;
      }
      return cached;
    }

    const sub = findSubResource(int, parsed.id);
    if (!sub || sub.type !== 'Theme') return null;
    // `parseInternalResource` echoes the heading's own `id` into `data` —
    // strip it back out, or it leaks into `properties` as a fake declared one.
    const { id: _id, ...properties } = sub.data as Record<string, string>;
    return resolveInlineThemeResource(properties, ext, int, fontCache, pendingFonts);
  }

  /**
   * Resolve every `theme_override_fonts/<name>` ref on a node, IN ITS OWN
   * SCOPE — `Control::get_theme_font`'s local-override branch
   * (`scene/gui/control.cpp:3089-3093`). Every declared key stays in the
   * result even when its ref fails to resolve (`null`): a local override,
   * once declared, wins UNCONDITIONALLY over any ancestor theme — see
   * `themeProcessing.resolveThemeFontIn`'s doc for why key PRESENCE (not the
   * resolved value) is what encodes "authored".
   */
  function resolveFontOverrides(
    node: TscnNode,
    ext: readonly TscnExternalResource[],
    int: readonly TscnInternalResource[]
  ): Readonly<Record<string, FontResource | null>> {
    const overrides = (node.properties as ControlProperties).themeOverrideFonts;
    if (!overrides) return {};
    const out: Record<string, FontResource | null> = {};
    for (const [key, ref] of Object.entries(overrides)) {
      out[key] = resolveInlineFontResource(ref, ext, int, fontCache, pendingFonts);
    }
    return out;
  }

  /** The project's default theme (`gui/theme/custom`) — same for every node, resolved once. */
  const projectTheme: ThemeResource | null = (() => {
    if (!projectThemeRef) return null;
    const cached = themeCache.getCached(projectThemeRef);
    if (cached === undefined) {
      pendingThemes.add(projectThemeRef);
      return null;
    }
    return cached;
  })();

  function resolveTextureSize(
    node: TscnNode,
    ext: readonly TscnExternalResource[],
    int: readonly TscnInternalResource[]
  ): Vec2 | null {
    // Whichever single Texture2D-valued property this node's own type
    // carries — TextureRect's `texture`, Button's (and its `Button`-family
    // subclasses') `icon`. The two never coexist on one node type, so
    // checking both generically here needs no per-type branch and leaves
    // TextureRect's own resolution untouched.
    const props = node.properties as Record<string, unknown>;
    const ref = props.texture ?? props.icon;
    if (typeof ref !== 'string' || ref === '') return null;

    // A texture whose size is written in the scene — an inline procedural one,
    // or a sheet cell whose region says how big it is — is known here and now:
    // no path, no cache, no pending load. This walk cannot call `useTexture2D`
    // (it is not a component), which is precisely why the size question has a
    // React-free answer of its own.
    const inline = inlineTexture2DSize(ref, int);
    if (inline) return inline;

    // `resolveTexture2DPath`, not `resolveExtResourcePath`: the painters resolve
    // the same property through it (`texturerect/NativeComponent.tsx`), so it
    // also unwraps a `SubResource(...)` texture. Resolving only ExtResource here
    // would give such a node a minimum size of (0, 0) while it still PAINTS —
    // inside a box or grid container it collapses to nothing and draws over its
    // siblings.
    const path = resolveTexture2DPath(ref, ext, int);
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
    scope: SceneScope,
    themeChain: readonly ThemeResource[]
  ): SolveNode[] {
    const { externalResources: ext } = scope;
    const out: SolveNode[] = [];
    for (const node of list) {
      // A SubViewport owns its own World2D (ADR-0033); its Control subtree is
      // drawn by its own viewport surface, never by the enclosing canvas.
      if (isViewportBoundary(node.type)) continue;

      const path = joinPath(parentPath, node.name);

      const scenePath = node.instance ? resolveInstancePath(node.instance, ext) : null;
      if (scenePath && sceneCache.getCached(scenePath) === undefined) pendingScenes.add(scenePath);

      const groups = liveChildGroups(node, scope, sceneCache);
      const mergedGroup = groups.find((g) => g.origin === 'merged');
      const collapsed = mergedGroup?.mergedNode ?? node;

      // A collapsed instance's own properties came from the sub-scene, so its
      // ids resolve there; every other node keeps the scope it was authored in.
      const ownScope = mergedGroup ? mergedGroup.scope : scope;

      const isControl = TWO_D_UI_TYPES.has(collapsed.type);

      // Godot: theme inheritance BREAKS at a non-Control/Window ancestor
      // (`ThemeOwner::propagate_theme_changed`, `scene/theme/theme_owner.cpp`:
      // "Theme inheritance chains are broken by nodes that aren't Control or
      // Window") — the mirror image of this walker's LAYOUT transparency for
      // the same node (module doc): transparent to layout, but a hard reset
      // for theme, so a Control nested under e.g. a Node3D never inherits an
      // ancestor's theme past it.
      const ownTheme = isControl
        ? resolveOwnTheme(
            (collapsed.properties as ControlProperties).theme,
            ownScope.externalResources,
            ownScope.internalResources
          )
        : null;
      const nodeThemeChain: readonly ThemeResource[] = !isControl
        ? []
        : ownTheme
          ? [ownTheme, ...themeChain]
          : themeChain;

      const children = groups.flatMap((g) => walk(g.children, path, g.scope, nodeThemeChain));

      if (isControl) {
        out.push({
          path,
          node: collapsed,
          children,
          styleBoxes: resolveStyleBoxes(collapsed, ownScope.internalResources),
          textureSize: resolveTextureSize(
            collapsed,
            ownScope.externalResources,
            ownScope.internalResources
          ),
          fontOverrides: resolveFontOverrides(collapsed, ownScope.externalResources, ownScope.internalResources),
          themeChain: nodeThemeChain,
          projectTheme,
        });
      } else {
        // Not a genuine Control type — transparent passthrough (see module doc):
        // no SolveNode of its own, its Control descendants promote up instead.
        out.push(...children);
      }
    }
    return out;
  }

  const tree = walk(nodes, '', { externalResources, internalResources }, []);
  return {
    tree,
    pendingScenes: [...pendingScenes],
    pendingTextures: [...pendingTextures],
    pendingThemes: [...pendingThemes],
    pendingFonts: [...pendingFonts],
  };
}

export function useBuildSolveTree(
  nodes: readonly TscnNode[],
  externalResources: readonly TscnExternalResource[],
  internalResources: readonly TscnInternalResource[]
): UseBuildSolveTreeResult {
  const loader = useResourceLoader();
  const [generation, setGeneration] = useState(0);
  // `gui/theme/custom` — the project's default theme, the last rung of the
  // ancestor walk before the built-in default (`ProjectSettingsContext`'s
  // safe-default value has no `settings`, so this is `undefined` without a
  // provider, matching every other un-set project setting).
  const projectThemeRef = useProjectSettings().settings?.['gui/theme/custom']?.trim() || undefined;

  useEffect(() => {
    const bump = () => setGeneration((g) => g + 1);
    // Not gated on `loader` — a runtime scene-font metrics load is triggered
    // by `peekSceneFontMetrics` from inside the SOLVE pass itself, never
    // through `loader`, so this subscription must live regardless of whether
    // a loader is present.
    const offSceneFontMetrics = onSceneFontMetricsSettled(bump);
    if (!loader) return offSceneFontMetrics;
    loader.eventBus.on('scene', 'loaded', bump);
    loader.eventBus.on('scene', 'failed', bump);
    loader.eventBus.on('texture', 'loaded', bump);
    loader.eventBus.on('texture', 'failed', bump);
    loader.eventBus.on('theme', 'loaded', bump);
    loader.eventBus.on('theme', 'failed', bump);
    loader.eventBus.on('font', 'loaded', bump);
    loader.eventBus.on('font', 'failed', bump);
    return () => {
      offSceneFontMetrics();
      loader.eventBus.off('scene', 'loaded', bump);
      loader.eventBus.off('scene', 'failed', bump);
      loader.eventBus.off('texture', 'loaded', bump);
      loader.eventBus.off('texture', 'failed', bump);
      loader.eventBus.off('theme', 'loaded', bump);
      loader.eventBus.off('theme', 'failed', bump);
      loader.eventBus.off('font', 'loaded', bump);
      loader.eventBus.off('font', 'failed', bump);
    };
  }, [loader]);

  const { tree, pendingScenes, pendingTextures, pendingThemes, pendingFonts } = useMemo(
    () => buildForest(nodes, externalResources, internalResources, loader, projectThemeRef),
    // `generation` is an intentional cache-buster: it increments each time a
    // scene/texture/theme/font load or failure lands so the walk re-derives
    // against the loader's now-different cache snapshot. Its value is not
    // read inside the callback — mirrors `useLiveSceneTree.ts`'s identical
    // `version` pattern.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [nodes, externalResources, internalResources, loader, projectThemeRef, generation]
  );

  // Kick off loads for anything the walk found uncached — after render, not
  // during it, matching `useResource`'s own request-in-effect convention.
  useEffect(() => {
    if (!loader) return;
    for (const path of pendingScenes) loader.scenes.request(path);
    for (const path of pendingTextures) loader.textures.request(path);
    for (const path of pendingThemes) loader.themes.request(path);
    for (const path of pendingFonts) loader.fonts.request(path);
  }, [loader, pendingScenes, pendingTextures, pendingThemes, pendingFonts]);

  return { tree, generation };
}
