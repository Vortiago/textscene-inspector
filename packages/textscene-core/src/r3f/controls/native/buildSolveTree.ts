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
 * `generation` bumps whenever ANY scene/texture/generic-resource/theme/font-
 * resource load/failure lands on the bus, OR a runtime font's metrics settle — a
 * scene-authored one, or the bundled font's own `FontFace` registration
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
  resolveExtAtlasTexturePath,
  resolveInstancePath,
  resolveTexture2DPath,
  unwrapCanvasTextureRef,
} from '../../../resources/SubResourceResolver';
import { useResourceLoader } from '../../../resources/useResource';
import { extResourceAtlasTextureSize, inlineTexture2DSize } from '../../../resources/useTexture2D';
import type { ResourceLoader } from '../../../resources/ResourceLoader';
import type { ParsedResource } from '../../../parser/parsedResource';
import { resolveInlineFontResource } from '../../../resources/fonts/font/decode';
import type { FontCacheReader, FontResource } from '../../../resources/fonts/font/types';
import { resolveInlineThemeResource } from '../../../resources/styles/theme/decode';
import type { ThemeResource } from '../../../resources/styles/theme/types';
import { onSceneFontMetricsSettled } from './text/sceneFontLoader';
import { useProjectSettings } from '../../contexts/ProjectSettingsContext';
import { useOptionalSelection } from '../../contexts/SelectionContext';
import { liveChildGroups, type CachedSceneSource, type SceneScope } from '../../liveSceneTree';
import { isViewportBoundary } from '../../../nodes/viewport/subviewport/viewportBoundary';
import { TWO_D_UI_TYPES } from '../has2DUIContent';
import { controlSolverRegistry } from './solverRegistry';
import type { SolveNode } from './solveTree';
import {
  allocatePaintRange,
  WHOLE_CANVAS_RANGE,
  type PaintRange,
} from '../../canvasPaintOrder';
import { parseStyleBox, type ResolvedStyleBox } from './parseStyleBox';
import type { Vec2 } from './rect';

export interface UseBuildSolveTreeResult {
  /** Top-level Control roots — real scene roots AND any promoted up through a skipped non-Control ancestor. */
  tree: readonly SolveNode[];
  /** Bumps on every scene/texture load or failure; a stable dep for a consumer's own memoisation. */
  generation: number;
}

const EMPTY_SCENE_CACHE: CachedSceneSource = { getCached: () => undefined };
const NO_TEXTURE_CACHE = { getCached: (): THREE.Texture | null | undefined => undefined };
const NO_RESOURCE_CACHE = { getCached: (): ParsedResource | null | undefined => undefined };
const NO_THEME_CACHE = { getCached: (): ThemeResource | null | undefined => undefined };
const NO_FONT_CACHE: FontCacheReader = { getCached: (): FontResource | null | undefined => undefined };

/**
 * Resolve every `theme_override_styles/*` ref on a node, IN ITS OWN SCOPE —
 * `scope` is already the collapsed node's own scope by the time `walk` calls
 * this (a sub-scene's SubResource pool for a merged/subscene node, the outer
 * pool otherwise). `parseStyleBox` degrades to `null` for an
 * absent/malformed/unresolvable ref, which this simply omits from the result
 * rather than fabricating a fallback stylebox. Covers all four concrete
 * StyleBox kinds (`native/parseStyleBox.ts`'s `ResolvedStyleBox`) — a
 * `StyleBoxLine`/`StyleBoxTexture` override is kept here exactly like a
 * `StyleBoxFlat` one, not dropped: each wraps a neutral `StyleBoxFlatData`
 * core carrying its own kind-correct `contentMargin`, so `SolveNode.styleBoxes`
 * (typed `Record<string, StyleBoxFlatData>`) stays satisfied without widening.
 */
export function resolveStyleBoxes(
  node: TscnNode,
  scope: SceneScope
): Readonly<Record<string, ResolvedStyleBox>> {
  const overrides = (node.properties as ControlProperties).themeOverrideStyles;
  if (!overrides) return {};
  const out: Record<string, ResolvedStyleBox> = {};
  for (const [key, ref] of Object.entries(overrides)) {
    const resolved = parseStyleBox(ref, scope.externalResources, scope.internalResources);
    if (resolved) out[key] = resolved;
  }
  return out;
}

/** An uncached sub-scene the walk found: the path to request, and the ExtResource to register first (absent for a raw `res://` instance). */
interface PendingScene {
  path: string;
  ext: TscnExternalResource | null;
}

interface ForestResult {
  tree: SolveNode[];
  pendingScenes: PendingScene[];
  pendingTextures: string[];
  pendingResourceFiles: string[];
  pendingThemes: string[];
  pendingFonts: string[];
}

/**
 * Builds the SolveNode forest for one (nodes, resource-scope) pair. Not a
 * hook itself — `useBuildSolveTree` is the only React-facing surface — so it
 * stays trivially testable and reusable if a future non-React consumer needs
 * the same walk (e.g. a headless render-to-texture pass).
 */
/** No provider (a headless/raster walk) hides nothing. */
const NO_HIDDEN: ReadonlySet<string> = new Set();

function buildForest(
  nodes: readonly TscnNode[],
  externalResources: readonly TscnExternalResource[],
  internalResources: readonly TscnInternalResource[],
  loader: ResourceLoader | null,
  projectThemeRef: string | undefined,
  hiddenNodePaths: ReadonlySet<string>
): ForestResult {
  const pendingScenes = new Map<string, PendingScene>();
  const pendingTextures = new Set<string>();
  const pendingResourceFiles = new Set<string>();
  const pendingThemes = new Set<string>();
  const pendingFonts = new Set<string>();

  const sceneCache: CachedSceneSource = loader
    ? { getCached: (p: string) => loader.scenes.getCached(p) }
    : EMPTY_SCENE_CACHE;
  const textureCache = loader ? { getCached: (p: string) => loader.textures.getCached(p) } : NO_TEXTURE_CACHE;
  const resourceCache = loader ? { getCached: (p: string) => loader.resources.getCached(p) } : NO_RESOURCE_CACHE;
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
   * `theme/lookup.ts`'s `resolveThemeFontIn` doc for why key PRESENCE (not the
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

  /**
   * One Texture2D-valued ref -> its pixel size, or null until it is known.
   * The ONE resolution both `resolveTextureSize`'s answers below run
   * through — the generic single-slot `textureSize` and every entry of a
   * registered type's `textureSlots` — so the two can never independently
   * disagree about the same ref.
   */
  function resolveTextureRefSize(
    ref: string,
    ext: readonly TscnExternalResource[],
    int: readonly TscnInternalResource[]
  ): Vec2 | null {
    // A texture whose size is written in the scene — an inline procedural one,
    // or a sheet cell whose region says how big it is — is known here and now:
    // no path, no cache, no pending load. This walk cannot call `useTexture2D`
    // (it is not a component), which is precisely why the size question has a
    // React-free answer of its own.
    const inline = inlineTexture2DSize(ref, int);
    if (inline) return inline;

    // An AtlasTexture saved as its OWN `.tres` (every Kenney input-prompt
    // icon ships this way) needs a load `inlineTexture2DSize` cannot make —
    // routed through the RESOURCE bus, never the texture one, since the file
    // is text (a cell's region), not pixels.
    const unwrapped = unwrapCanvasTextureRef(ref, int);
    const atlasTresPath = resolveExtAtlasTexturePath(unwrapped, ext);
    if (atlasTresPath) {
      const cachedTres = resourceCache.getCached(atlasTresPath);
      if (cachedTres === undefined) {
        pendingResourceFiles.add(atlasTresPath);
        return null;
      }
      if (cachedTres === null) return null;
      // The sheet's own size only matters for a region axis that rounds to
      // zero (`atlasTextureLayout`'s own doc) — `inlineTexture2DSize` never
      // fetches it for the inline form either, so this stays consistent.
      return extResourceAtlasTextureSize(cachedTres, null);
    }

    // `resolveTexture2DPath`, not `resolveExtResourcePath`: the painters resolve
    // the same property through it (`texturerect/Component.tsx`), so it
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

  /** `resolveTextureSize`'s answer for a node whose type never registers a `TextureSlotsFn`. */
  const EMPTY_TEXTURE_SLOTS: Readonly<Record<string, Vec2 | null>> = {};

  /**
   * This node's `textureSize` (the single generic slot every unregistered
   * type keeps — TextureRect's `texture`, Button's `icon`, never both on one
   * type) and `textureSlots` (every slot a registered type's own
   * `TextureSlotsFn` names — `TextureProgressBar`'s three layers,
   * `TextureButton`'s draw-state textures, `RichTextLabel`'s embedded
   * `[img]`s) — both built from `resolveTextureRefSize` above, never a
   * second, independently-computed answer.
   */
  function resolveTextureSize(
    node: TscnNode,
    ext: readonly TscnExternalResource[],
    int: readonly TscnInternalResource[]
  ): { size: Vec2 | null; slots: Readonly<Record<string, Vec2 | null>> } {
    const slotsFn = controlSolverRegistry.textureSlots(node.type);
    if (slotsFn) {
      const requests = slotsFn(node);
      const slots: Record<string, Vec2 | null> = {};
      for (const { key, ref } of requests) {
        slots[key] = ref ? resolveTextureRefSize(ref, ext, int) : null;
      }
      // The FIRST registered request stands in for `textureSize` — matches
      // Godot's own first-priority slot for every registering type today
      // (`TextureButton`'s `texture_normal`), never re-derived independently.
      const primaryKey = requests[0]?.key;
      return { size: primaryKey !== undefined ? (slots[primaryKey] ?? null) : null, slots };
    }

    // No per-type registration: the single generic slot every other 2D-UI
    // type carries at most one of.
    const props = node.properties as Record<string, unknown>;
    const ref = props.texture ?? props.icon;
    const size = typeof ref === 'string' && ref !== '' ? resolveTextureRefSize(ref, ext, int) : null;
    return { size, slots: EMPTY_TEXTURE_SLOTS };
  }

  /** A `y_sort_enabled` parent re-orders its children, so the behind/ahead split does not apply. */
  function sortsChildren(node: TscnNode): boolean {
    return (node.properties as { y_sort_enabled?: boolean }).y_sort_enabled === true;
  }

  function walk(
    list: readonly TscnNode[],
    parentPath: string,
    scope: SceneScope,
    themeChain: readonly ThemeResource[],
    ranges: readonly PaintRange[]
  ): SolveNode[] {
    const { externalResources: ext } = scope;
    const out: SolveNode[] = [];
    for (const [index, node] of list.entries()) {
      const paintRange = ranges[index] ?? WHOLE_CANVAS_RANGE;
      // A SubViewport owns its own World2D (ADR-0033); its Control subtree is
      // drawn by its own viewport surface, never by the enclosing canvas.
      if (isViewportBoundary(node.type)) continue;

      const path = joinPath(parentPath, node.name);

      const scenePath = node.instance ? resolveInstancePath(node.instance, ext) : null;
      if (scenePath && sceneCache.getCached(scenePath) === undefined) {
        // The ExtResource itself, not just the path: `createSceneProcessor` throws
        // "Scene metadata not found" for an unregistered address and the failure is
        // cached permanently, so the registration must precede the request. A raw
        // `res://` instance names no ExtResource to register — it is still requested,
        // as the world walk requests it, rather than silently never loading.
        const parsed = node.instance ? parseResourceReference(node.instance) : null;
        const entry = parsed?.type === 'ExtResource' ? ext.find((r) => r.id === parsed.id) : undefined;
        // One path can be reached both ways in a single walk; an ExtResource already
        // recorded for it is never overwritten by a raw-path node's absent one.
        if (!pendingScenes.get(scenePath)?.ext) {
          pendingScenes.set(scenePath, { path: scenePath, ext: entry ?? null });
        }
      }

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

      // The SAME allocation the world walk applies to the same children, from
      // the same pure function — which is what makes the two walks' sequence
      // numbers comparable without either knowing the other exists.
      // Which children the world walk allocates from the node's OWN run, and
      // which from the tail it reserves.
      //
      // `NodeDispatcher` dispatches a node's authored children inline and an
      // instance's injected sub-scene ROOTS from `allocated.tail`. This walk
      // sees both as `liveChildGroups` output, so it has to make the same
      // split — otherwise a Control inside a multi-root instance is numbered
      // against a different scale than the world content it interleaves with,
      // and the two walks' whole reason for deriving the same numbers from the
      // same nodes is lost.
      const injected = (origin: string) => origin === 'subscene' || origin === 'glb';
      const inlineChildren = groups.filter((g) => !injected(g.origin)).flatMap((g) => g.children);
      const allocated = allocatePaintRange(paintRange, inlineChildren, sortsChildren(collapsed));
      const injectedRanges = allocatePaintRange(
        allocated.tail,
        groups.filter((g) => injected(g.origin)).flatMap((g) => g.children)
      ).children;

      // Each group walks with the slice of ranges belonging to ITS children.
      // Both allocations are over flattened lists, so the slices are handed
      // back out in the order they were taken.
      const children: SolveNode[] = [];
      let takenInline = 0;
      let takenInjected = 0;
      for (const group of groups) {
        const count = group.children.length;
        const groupRanges = injected(group.origin)
          ? injectedRanges.slice(takenInjected, (takenInjected += count))
          : allocated.children.slice(takenInline, (takenInline += count));
        children.push(...walk(group.children, path, group.scope, nodeThemeChain, groupRanges));
      }

      if (isControl) {
        const texture = resolveTextureSize(collapsed, ownScope.externalResources, ownScope.internalResources);
        out.push({
          path,
          node: collapsed,
          children,
          paintRange,
          paintSequence: allocated.self,
          hidden: hiddenNodePaths.has(path),
          styleBoxes: resolveStyleBoxes(collapsed, ownScope),
          textureSize: texture.size,
          textureSlots: texture.slots,
          fontOverrides: resolveFontOverrides(collapsed, ownScope.externalResources, ownScope.internalResources),
          resources: ownScope,
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

  const tree = walk(
    nodes,
    '',
    { externalResources, internalResources },
    [],
    allocatePaintRange(WHOLE_CANVAS_RANGE, nodes).children
  );
  return {
    tree,
    pendingScenes: [...pendingScenes.values()],
    pendingTextures: [...pendingTextures],
    pendingResourceFiles: [...pendingResourceFiles],
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
  const hiddenNodePaths = useOptionalSelection()?.hiddenNodePaths ?? NO_HIDDEN;
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
    // An `ExtResource(AtlasTexture)` `.tres` completes on the RESOURCE bus,
    // never the texture one — `resolveTextureRefSize`'s own doc — so a sibling
    // subscription is required, or the first solve after such a load never
    // re-runs.
    loader.eventBus.on('resource', 'loaded', bump);
    loader.eventBus.on('resource', 'failed', bump);
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
      loader.eventBus.off('resource', 'loaded', bump);
      loader.eventBus.off('resource', 'failed', bump);
      loader.eventBus.off('theme', 'loaded', bump);
      loader.eventBus.off('theme', 'failed', bump);
      loader.eventBus.off('font', 'loaded', bump);
      loader.eventBus.off('font', 'failed', bump);
    };
  }, [loader]);

  const { tree, pendingScenes, pendingTextures, pendingResourceFiles, pendingThemes, pendingFonts } = useMemo(
    () =>
      buildForest(
        nodes,
        externalResources,
        internalResources,
        loader,
        projectThemeRef,
        hiddenNodePaths
      ),
    // `generation` is an intentional cache-buster: it increments each time a
    // scene/texture/resource-file/theme/font load or failure lands so the
    // walk re-derives against the loader's now-different cache snapshot. Its
    // value is not read inside the callback — mirrors `useLiveSceneTree.ts`'s
    // identical `version` pattern.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [nodes, externalResources, internalResources, loader, projectThemeRef, hiddenNodePaths, generation]
  );

  // Kick off loads for anything the walk found uncached — after render, not
  // during it, matching `useResource`'s own request-in-effect convention.
  useEffect(() => {
    if (!loader) return;
    for (const pending of pendingScenes) {
      if (pending.ext) loader.register(pending.ext);
      loader.scenes.request(pending.path);
    }
    for (const path of pendingTextures) loader.textures.request(path);
    for (const path of pendingResourceFiles) loader.resources.request(path);
    for (const path of pendingThemes) loader.themes.request(path);
    for (const path of pendingFonts) loader.fonts.request(path);
  }, [loader, pendingScenes, pendingTextures, pendingResourceFiles, pendingThemes, pendingFonts]);

  return { tree, generation };
}
