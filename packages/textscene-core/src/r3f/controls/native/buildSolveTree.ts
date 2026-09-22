/**
 * `useBuildSolveTree` — the live-tree walker that turns a Control subtree
 * into the `SolveNode` forest `controlRectSolver.ts` consumes. Built on
 * `liveSceneTree.ts`'s shared traversal (`liveChildGroups`) rather than
 * re-deriving PackedScene-instancing/GLB-descent/per-sub-scene-scope rules —
 * the "node inside an instance is invisible" bug class that module exists to
 * kill.
 *
 * A non-Control ancestor (a `Node2D` holding a widget, a `Node3D` housing an
 * instanced HUD, or the raw `Node` an unresolved/multi-root instance parses
 * as) contributes no `SolveNode` of its own: it is transparently skipped and
 * its own children are walked in its place. `TWO_D_UI_TYPES`
 * (`has2DUIContent.ts`) is the existing mirror of "which types are genuinely
 * Control-ish"; this module reads it rather than keeping a second list.
 *
 * WHERE the Control beneath it lands is decided by that node's own type,
 * because it is in Godot: `NOTIFICATION_ENTER_CANVAS` climbs `CanvasItem`
 * parents looking for a Control (`control.cpp:3874-3890`) and `_enter_canvas`
 * parents the canvas item where that climb ended (`canvas_item.cpp:234-285`).
 *
 * - A `Node2D` is a `CanvasItem`, so the climb passes through it and the
 *   Control is PROMOTED to the nearest real Control. It still draws inside
 *   that ancestor, so the Node2D's own transform, `modulate` and `z_index`
 *   ride along in `SolveNode.skippedAncestors` (accumulated by
 *   `nextSkippedAncestors`, applied by `ControlCanvasWalker`) — and, being a
 *   grandchild rather than a child, it anchors against the Node2D's own
 *   `Rect2(0, 0, 0, 0)` and is invisible to any Container above it
 *   (`controlRectSolver.ts`).
 * - A `Node3D` or raw `Node` is not, so the climb ends there: the Control is a
 *   canvas ROOT and is HOISTED out to the nearest enclosing canvas boundary,
 *   or to this forest's own roots. Nothing above the break reaches it — not a
 *   rect to anchor against, not a transform, not a tint, not a z — and it
 *   draws in its pre-order rank among that canvas's roots rather than at the
 *   slot its own position in the file gives it (`canvasRootRanges`). A
 *   `CanvasLayer` (and its subclass `ParallaxBackground`) ends the climb the
 *   same way, but it keeps a `SolveNode` of its own
 *   (`controlSolverRegistry.isCanvasBoundary`), so it is where those hoisted
 *   Controls land rather than something they are hoisted past.
 * - `top_level` ends the climb wherever it appears, because the loop's own
 *   condition is `while (!node->is_set_as_top_level())` (`control.cpp:3876`).
 *   On the Control itself it also strips `skippedAncestors`, since
 *   `get_parent_item()` returns nullptr before the parent cast runs
 *   (`canvas_item.cpp:565-571`) and no Container lays such a child out
 *   (`container.cpp:144-146`).
 *
 * VISIBILITY does none of that. It is a SCENE-tree rule, not a canvas-parenting
 * one: `NOTIFICATION_ENTER_TREE` casts the direct parent to `CanvasItem` with
 * no `top_level` test (`canvas_item.cpp:311-316`) and
 * `_handle_visibility_change` propagates into every CanvasItem child, top_level
 * ones included (`canvas_item.cpp:103-108`). So it crosses both breaks above
 * and travels on `SolveNode.parentVisibleInTree` rather than in
 * `skippedAncestors` — with resets of its own, at a `CanvasLayer` and at every
 * non-CanvasItem parent (`childParentVisibleInTree`).
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
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */

import { useEffect, useMemo, useState } from 'react';
import * as THREE from 'three';
import type { TscnExternalResource, TscnInternalResource, TscnNode } from '../../../parser/types';
import type { ControlColor, ControlProperties } from '../../../nodes/2d/ui/control/types';
import type { Node2DProperties } from '../../../nodes/base/node2d/types';
import { descendsFrom } from '../../../godot/nodeBaseTypes';
import { resolveLayoutRtl, type LayoutDirectionEnv } from '../../../godot/index.js';
import { projectLayoutDirectionEnv } from '../../../parser/projectSettingsParser';
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
import { mergeThemedRecord, themeResolutionScope, type ThemeResolutionScope } from '../../../resources/styles/theme/lookup';
import { onSceneFontMetricsSettled } from './text/sceneFontLoader';
import { useProjectSettings } from '../../contexts/ProjectSettingsContext';
import { useOptionalSelection } from '../../contexts/SelectionContext';
import { liveChildGroups, type CachedSceneSource, type SceneScope } from '../../liveSceneTree';
import { isViewportBoundary } from '../../../nodes/viewport/subviewport/viewportBoundary';
import { TWO_D_UI_TYPES } from '../has2DUIContent';
import { controlSolverRegistry, type ChildVisibilityFn } from './solverRegistry';
import type { Affine2D, SkippedAncestors, SolveNode, ThemedIconRef } from './solveTree';
import { multiplyModulate, WHITE_MODULATE } from '../../canvasItemModulate';
import {
  allocatePaintRange,
  canvasRootRanges,
  isCanvasLayerType,
  isTopLevelItem,
  WHOLE_CANVAS_RANGE,
  type PaintRange,
} from '../../canvasPaintOrder';
import { parseStyleBox, type ResolvedStyleBox } from './parseStyleBox';
import type { Vec2 } from './rect';

export interface UseBuildSolveTreeResult {
  /** Every Control whose canvas item parents at the viewport's own canvas — real scene roots, Controls promoted up through a skipped non-Control ancestor, Controls hoisted out of a broken CanvasItem chain, and `top_level` Controls. */
  tree: readonly SolveNode[];
  /** Bumps on every scene/texture load or failure; a stable dep for a consumer's own memoisation. */
  generation: number;
}

const EMPTY_SCENE_CACHE: CachedSceneSource = { getCached: () => undefined };
const NO_TEXTURE_CACHE = { getCached: (): THREE.Texture | null | undefined => undefined };
const NO_RESOURCE_CACHE = { getCached: (): ParsedResource | null | undefined => undefined };
const NO_THEME_CACHE = { getCached: (): ThemeResource | null | undefined => undefined };
const NO_FONT_CACHE: FontCacheReader = { getCached: (): FontResource | null | undefined => undefined };

/** No ancestor/project theme — `mergeThemedRecord` walks nothing and returns the seed unchanged. */
const NO_THEME_SCOPE: ThemeResolutionScope = { typeChain: [], searchOrder: [] };

/**
 * A theme's `styles` raw refs, resolved to `ResolvedStyleBox` against THAT
 * theme's own sub-resource pool (never the querying node's — a Theme's
 * StyleBoxes are sub-resources of the theme file, `types.ts`'s own doc).
 * Memoised per `ThemeResource` OBJECT (a file-backed theme is cached and
 * reused across every node that references it, so this resolves each once
 * per theme rather than once per node × key), mirroring
 * `text/resolveNodeFontMetrics.ts`'s `scopeFor` cache.
 */
const themeStyleBoxCache = new WeakMap<
  ThemeResource,
  Readonly<Record<string, Readonly<Record<string, ResolvedStyleBox>>>>
>();

function resolvedStylesOfTheme(
  theme: ThemeResource
): Readonly<Record<string, Readonly<Record<string, ResolvedStyleBox>>>> {
  const cached = themeStyleBoxCache.get(theme);
  if (cached) return cached;
  const { externalResources, internalResources } = theme.resources ?? { externalResources: [], internalResources: [] };
  const out: Record<string, Record<string, ResolvedStyleBox>> = {};
  for (const [type, byName] of Object.entries(theme.styles ?? {})) {
    for (const [name, ref] of Object.entries(byName)) {
      const resolved = parseStyleBox(ref, externalResources, internalResources);
      if (resolved) (out[type] ??= {})[name] = resolved;
    }
  }
  themeStyleBoxCache.set(theme, out);
  return out;
}

/**
 * Resolve every StyleBox slot this node can draw, keyed the way
 * `Control::get_theme_stylebox` keys them (`solveTree.ts`'s own doc):
 * `theme_override_styles/*` on the node ITSELF, IN ITS OWN SCOPE — `scope` is
 * already the collapsed node's own scope by the time `walk` calls this (a
 * sub-scene's SubResource pool for a merged/subscene node, the outer pool
 * otherwise) — wins unconditionally over anything `themeScope`'s ancestor/
 * project theme chain supplies for the SAME name (`mergeThemedRecord`'s
 * seed). `parseStyleBox` degrades to `null` for an absent/malformed/
 * unresolvable ref, which this simply omits rather than fabricating a
 * fallback stylebox. Covers all four concrete StyleBox kinds (`native/
 * parseStyleBox.ts`'s `ResolvedStyleBox`) — a `StyleBoxLine`/`StyleBoxTexture`
 * override is kept here exactly like a `StyleBoxFlat` one, not dropped: each
 * wraps a neutral `StyleBoxFlatData` core carrying its own kind-correct
 * `contentMargin`, so `SolveNode.styleBoxes` (typed `Record<string,
 * StyleBoxFlatData>`) stays satisfied without widening.
 */
export function resolveStyleBoxes(
  node: TscnNode,
  scope: SceneScope,
  themeScope: ThemeResolutionScope = NO_THEME_SCOPE
): Readonly<Record<string, ResolvedStyleBox>> {
  const overrides = (node.properties as ControlProperties).themeOverrideStyles;
  const local: Record<string, ResolvedStyleBox> = {};
  if (overrides) {
    for (const [key, ref] of Object.entries(overrides)) {
      const resolved = parseStyleBox(ref, scope.externalResources, scope.internalResources);
      if (resolved) local[key] = resolved;
    }
  }
  return mergeThemedRecord(themeScope, local, resolvedStylesOfTheme);
}

/**
 * Resolve every theme colour this node can draw, keyed the way
 * `Control::get_theme_color` keys them: `theme_override_colors/*` on the
 * node itself (unconditional local override — no validity gate, same as
 * StyleBox/Constant), else `themeScope`'s ancestor/project theme chain.
 */
function resolveThemedColors(
  node: TscnNode,
  themeScope: ThemeResolutionScope
): Readonly<Record<string, ControlColor>> {
  const local = (node.properties as ControlProperties).themeOverrideColors ?? {};
  return mergeThemedRecord(themeScope, local, (theme) => theme.colors);
}

/**
 * The constant counterpart of `resolveThemedColors` (`Control::
 * get_theme_constant`). A scene Theme's own `<Type>/constants/<name>` is a
 * literal, unscaled int — only this previewer's OWN built-in default (a
 * painter's own fallback on a miss here) is scaled.
 */
function resolveThemedConstants(
  node: TscnNode,
  themeScope: ThemeResolutionScope
): Readonly<Record<string, number>> {
  const local = (node.properties as ControlProperties).themeOverrideConstants ?? {};
  return mergeThemedRecord(themeScope, local, (theme) => theme.constants);
}

/**
 * A theme's `icons` raw refs, wrapped with THAT theme's own resource scope —
 * mirrors `resolvedStylesOfTheme`, but an icon ref is left UNRESOLVED
 * (`ThemedIconRef`'s own doc: loading a texture needs a live
 * `useTexture2D` subscription only a component can hold), so this only
 * pairs each ref with its scope rather than decoding it. Memoised per
 * `ThemeResource` object for the same reason `resolvedStylesOfTheme` is.
 */
const themeIconRefCache = new WeakMap<
  ThemeResource,
  Readonly<Record<string, Readonly<Record<string, ThemedIconRef>>>>
>();

function iconRefsOfTheme(
  theme: ThemeResource
): Readonly<Record<string, Readonly<Record<string, ThemedIconRef>>>> {
  const cached = themeIconRefCache.get(theme);
  if (cached) return cached;
  const resources = theme.resources ?? { externalResources: [], internalResources: [] };
  const out: Record<string, Record<string, ThemedIconRef>> = {};
  for (const [type, byName] of Object.entries(theme.icons ?? {})) {
    for (const [name, ref] of Object.entries(byName)) {
      (out[type] ??= {})[name] = { ref, resources };
    }
  }
  themeIconRefCache.set(theme, out);
  return out;
}

/**
 * This node's resolved theme icons — `Control::get_theme_icon`'s own local-
 * override-then-ancestor-chain walk (`solveTree.ts`'s `SolveNode.icons` own
 * doc), the icon counterpart of `resolveThemedColors`/`resolveThemedConstants`.
 * A local `theme_override_icons/<name>` ref is wrapped with the NODE's own
 * scope (`scope`, already the collapsed node's own by the time `walk` calls
 * this); an ancestor/project Theme's `<Type>/icons/<name>` is wrapped with
 * THAT theme's own scope by `iconRefsOfTheme`.
 */
export function resolveThemedIcons(
  node: TscnNode,
  scope: SceneScope,
  themeScope: ThemeResolutionScope
): Readonly<Record<string, ThemedIconRef>> {
  const overrides = (node.properties as ControlProperties).themeOverrideIcons;
  const local: Record<string, ThemedIconRef> = {};
  if (overrides) {
    for (const [key, ref] of Object.entries(overrides)) {
      local[key] = { ref, resources: scope };
    }
  }
  return mergeThemedRecord(themeScope, local, iconRefsOfTheme);
}

/** An uncached sub-scene the walk found: the path to request, and the ExtResource to register first (absent for a raw `res://` instance). */
interface PendingScene {
  path: string;
  ext: TscnExternalResource | null;
}

/**
 * One `walk` level's output, split by where each Control's canvas item parents.
 *
 * `hoisted` holds the Controls whose `CanvasItem` chain broke below this level
 * (`control.cpp:3874-3890`): Godot parents those at the enclosing CanvasLayer's
 * canvas, or the viewport's World2D canvas, never at an ancestor item
 * (`canvas_item.cpp:234-285`). They travel up past every intervening Control
 * until a canvas boundary — or the forest root — adopts them, which is what
 * keeps an ancestor's rect, transform, modulate and z off them.
 */
interface WalkResult {
  nodes: SolveNode[];
  hoisted: SolveNode[];
}

interface ForestResult {
  tree: SolveNode[];
  pendingScenes: PendingScene[];
  pendingTextures: string[];
  pendingResourceFiles: string[];
  pendingThemes: string[];
  pendingFonts: string[];
}

// --- Skipped-ancestor CanvasItem transform ------------------------------------

/**
 * Composes `local`'s space into `parent`'s — `Transform2D::operator*`
 * (`core/math/transform_2d.cpp:198-217`): apply `local` first, then `parent`.
 * `null` stands for the identity transform, so the FIRST skipped ancestor in
 * a chain composes against nothing rather than a caller having to invent an
 * identity literal.
 */
export function composeAncestorAffine(parent: Affine2D | null, local: Affine2D): Affine2D {
  if (!parent) return local;
  return {
    a: parent.a * local.a + parent.c * local.b,
    b: parent.b * local.a + parent.d * local.b,
    c: parent.a * local.c + parent.c * local.d,
    d: parent.b * local.c + parent.d * local.d,
    tx: parent.a * local.tx + parent.c * local.ty + parent.tx,
    ty: parent.b * local.tx + parent.d * local.ty + parent.ty,
  };
}

/**
 * A Node2D-shaped node's own LOCAL `Transform2D`, from its discrete
 * properties — `Transform2D(rot, scale, skew, pos)`
 * (`core/math/transform_2d.h:249-254`, `set_rotation_scale_and_skew`). Every
 * Node2D-descended type's properties carry these four fields, defaulted
 * exactly as Node2D's own parser defaults them (`nodes/base/node2d/parser.ts`)
 * — repeated here (rather than trusted to already be set) since a hand-built
 * `SolveNode`'s properties bag is not guaranteed to have gone through that
 * parser at all.
 */
export function node2DAncestorAffine(props: Node2DProperties): Affine2D {
  const position = props.position ?? { x: 0, y: 0 };
  const rotation = props.rotation ?? 0;
  const scale = props.scale ?? { x: 1, y: 1 };
  const skew = props.skew ?? 0;
  return {
    a: Math.cos(rotation) * scale.x,
    b: Math.sin(rotation) * scale.x,
    // `0 - v`, not `-v`: a zero rotation/skew must stay +0, never -0.
    c: 0 - Math.sin(rotation + skew) * scale.y,
    d: Math.cos(rotation + skew) * scale.y,
    tx: position.x,
    ty: position.y,
  };
}

/**
 * Whether `Object::cast_to<CanvasItem>` would accept this (already-known-
 * non-Control) node — `CanvasItem::get_parent_item()`'s own test
 * (`canvas_item.cpp:565-571`). Node2D is the only CanvasItem branch a scene
 * can author below a Control that is not itself a Control.
 */
function isCanvasItem(node: TscnNode): boolean {
  return descendsFrom(node.type, 'Node2D');
}

/**
 * Whether a container's own `set_visible` write reaches this DIRECT child —
 * `Container::as_sortable_control(get_child(i), IGNORE)`, which casts the
 * child to `Control` and rejects a `top_level` one ahead of every visibility
 * mode (`container.cpp:143-146`). `TWO_D_UI_TYPES` also covers `CanvasLayer`,
 * which is no Control at all, so it is excluded here. A Control promoted past
 * a Node2D never reaches this: it is a grandchild, so `get_child(i)` never
 * yields it.
 */
function isSortableChild(live: TscnNode): boolean {
  return TWO_D_UI_TYPES.has(live.type) && !isTopLevelItem(live) && !isCanvasLayerType(live.type);
}

/**
 * What a promoted Control's DESCENDANTS inherit through this
 * (already-known-non-Control) `collapsed` node.
 *
 * `CanvasItem::get_parent_item()` casts only the DIRECT parent
 * (`scene/main/canvas_item.cpp:565-571`) — `Object::cast_to<CanvasItem>
 * (get_parent())`, after `if (top_level) return nullptr;`. So a chain of
 * Node2D-descended ancestors composes, but the moment a non-`CanvasItem` link
 * appears (a plain `Node`, a `Node3D`, a `CanvasLayer`) the walk that builds
 * the RenderingServer's own canvas-item parent chain gives up on climbing it
 * and reparents at the nearest `CanvasLayer`/`Viewport` instead
 * (`canvas_item.cpp:246-267`). Everything above the break, Node2D or not,
 * stops contributing: reset to `null` rather than left unchanged, so a broken
 * link cannot leak an ancestor's transform, tint or z from ABOVE it into a
 * promoted Control below it.
 *
 * Visibility is NOT one of the facets: it is read off the direct parent by
 * `NOTIFICATION_ENTER_TREE` with no `top_level` test
 * (`canvas_item.cpp:311-316`), so it survives breaks this value resets at —
 * `SolveNode.parentVisibleInTree` carries it instead.
 */
export function nextSkippedAncestors(
  collapsed: TscnNode,
  previous: SkippedAncestors | null
): SkippedAncestors | null {
  if (!isCanvasItem(collapsed)) return null;
  const props = collapsed.properties as Node2DProperties;
  return {
    transform: composeAncestorAffine(previous?.transform ?? null, node2DAncestorAffine(props)),
    // `_cull_canvas_item` folds each item's `modulate` into what its children
    // inherit (`renderer_canvas_cull.cpp`); `self_modulate` stays own-pixel.
    modulate: multiplyModulate(previous?.modulate ?? WHITE_MODULATE, props.modulate ?? WHITE_MODULATE),
    // Appended rather than summed: `p_z` is CLAMPed at every step and a
    // `z_relative == false` item restarts from its own `z_index`
    // (`renderer_canvas_cull.cpp:430-434`), so only the walker — which knows
    // the ambient z this chain starts from — can fold it.
    z: [...(previous?.z ?? []), { zIndex: props.z_index ?? 0, zAsRelative: props.z_as_relative !== false }],
  };
}

/**
 * What `nodes`' own children inherit as `CanvasItem::parent_visible_in_tree`,
 * given this node's own effective `visible` and what IT inherited.
 *
 * `NOTIFICATION_ENTER_TREE` (`canvas_item.cpp:311-350`) reads it off the
 * DIRECT parent in three arms, and this is all three: a `CanvasItem` parent
 * contributes `ci->is_visible_in_tree()` — `visible && parent_visible_in_tree`
 * (`canvas_item.cpp:62-64`), and note the cast has no `top_level` test, unlike
 * `get_parent_item()`'s; a `CanvasLayer` parent contributes its OWN
 * `is_visible()` alone, cutting off everything above it; anything else climbs
 * to the enclosing `Viewport` and takes the root `Window`'s visibility (true
 * for a loaded scene) or, inside a `SubViewport`, plain `true`.
 */
function childParentVisibleInTree(
  node: TscnNode,
  ownVisible: boolean,
  parentVisibleInTree: boolean
): boolean {
  if (descendsFrom(node.type, 'CanvasItem')) return parentVisibleInTree && ownVisible;
  if (isCanvasLayerType(node.type)) return ownVisible;
  return true;
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
  hiddenNodePaths: ReadonlySet<string>,
  layoutDirectionEnv: LayoutDirectionEnv,
  inheritedRtl: boolean | null
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
    int: readonly TscnInternalResource[],
    themedIcons: Readonly<Record<string, ThemedIconRef>>
  ): { size: Vec2 | null; slots: Readonly<Record<string, Vec2 | null>> } {
    const slotsFn = controlSolverRegistry.textureSlots(node.type);
    if (slotsFn) {
      const requests = slotsFn(node, themedIcons);
      const slots: Record<string, Vec2 | null> = {};
      for (const { key, ref, scope } of requests) {
        slots[key] = ref
          ? resolveTextureRefSize(ref, scope?.externalResources ?? ext, scope?.internalResources ?? int)
          : null;
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

  /**
   * The `visible` a registered container writes onto each of its direct
   * sortable Control children, keyed by the RAW child node.
   *
   * Built here rather than inside the child's own walk because the numbering
   * is the container's: `TabContainer::_get_tab_controls` runs one
   * `get_child(i)` loop over the whole child list (`tab_container.cpp:469-481`),
   * which this walk splits across `liveChildGroups` groups — an index reset per
   * group would renumber every page of a container whose pages arrived through
   * an instance.
   */
  function resolveChildVisibility(
    fn: ChildVisibilityFn,
    container: TscnNode,
    groups: ReturnType<typeof liveChildGroups>
  ): ReadonlyMap<TscnNode, boolean> {
    const sortable: { raw: TscnNode; live: TscnNode }[] = [];
    for (const group of groups) {
      for (const child of group.children) {
        const merged = liveChildGroups(child, group.scope, sceneCache).find((g) => g.origin === 'merged');
        const live = merged?.mergedNode ?? child;
        if (isSortableChild(live)) sortable.push({ raw: child, live });
      }
    }
    const out = new Map<TscnNode, boolean>();
    for (const [index, entry] of sortable.entries()) {
      const written = fn(container, entry.live, index, sortable.length);
      if (written !== undefined) out.set(entry.raw, written);
    }
    return out;
  }

  function walk(
    list: readonly TscnNode[],
    parentPath: string,
    scope: SceneScope,
    themeChain: readonly ThemeResource[],
    ranges: readonly PaintRange[],
    /** What every skipped Node2D-descended ancestor since the last real Control/root contributes — see `nextSkippedAncestors`. */
    skippedAncestors: SkippedAncestors | null,
    /**
     * Whether a non-`CanvasItem` link sits between here and the nearest
     * enclosing Control — `NOTIFICATION_ENTER_CANVAS`'s climb ending with
     * `has_parent_control == false` (`control.cpp:3874-3890`). A Control found
     * under one is a canvas ROOT, so it hoists rather than nesting.
     */
    canvasChainBroken: boolean,
    /**
     * The eye toggle of every ancestor, whatever its type — the outliner's
     * subtree, not Godot's canvas parenting, so it never resets. A skipped
     * ancestor leaves no node of its own to hide, and a hoisted Control leaves
     * the ancestor's emitted group entirely; both would otherwise escape a
     * toggle `NodeDispatcher` applies with one `<group visible>`.
     */
    ancestorHidden: boolean,
    /**
     * `CanvasItem::parent_visible_in_tree` for `list` — Godot's own
     * scene-tree visibility conjunction, which is a DIFFERENT rule from
     * `ancestorHidden` above and so a different value (see
     * `SolveNode.parentVisibleInTree`): the eye toggle never resets, this
     * resets at a `CanvasLayer` and at every non-CanvasItem parent.
     */
    parentVisibleInTree: boolean,
    /**
     * Where each canvas root of the enclosing canvas draws — the draw index a
     * canvas hands its roots, which is their pre-order rank among THEM and not
     * the slot their nesting gives them (`canvasRootRanges`). One map per
     * canvas, so a node found in it takes that run instead of its parent's.
     */
    canvasRoots: ReadonlyMap<TscnNode, PaintRange>,
    /**
     * The nearest drawn ancestor Control's own `is_layout_rtl()`, or `null`
     * where the climb would run off the top of the tree
     * (`scene/gui/control.cpp:3584-3608`). Passed through every other node type
     * unchanged, since the climb steps over those rather than stopping at them
     * — a `Window` is the one exception Godot makes that this walk cannot, as
     * no Window type is drawn here at all.
     */
    inheritedRtl: boolean | null,
    /**
     * The `visible` the enclosing container writes onto each of its direct
     * sortable Control children (`ChildVisibilityFn`), keyed by the raw child
     * node — `undefined` where the container writes none, and a child absent
     * from the map is one the cast refused. Resolved by the PARENT (where the
     * sortable numbering is known, across every `liveChildGroups` group at
     * once) and merely looked up here. Applied as a property write rather than
     * left to the container's own `ContainerLayoutFn`, because Godot's
     * mechanism IS a property write — one every reader of `visible` (the
     * painter's group, `isSortableControl`, every ancestor container above it)
     * already honours.
     */
    childVisibility: ReadonlyMap<TscnNode, boolean> | undefined
  ): WalkResult {
    const { externalResources: ext } = scope;
    const out: SolveNode[] = [];
    const hoisted: SolveNode[] = [];
    for (const [index, node] of list.entries()) {
      const paintRange = canvasRoots.get(node) ?? ranges[index] ?? WHOLE_CANVAS_RANGE;
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

      // A CanvasLayer counts as `isControl` here without being a Control at
      // all, so it never states a direction and simply passes one through.
      const rtl = isControl
        ? resolveLayoutRtl(
            (collapsed.properties as ControlProperties).layoutDirection,
            inheritedRtl,
            layoutDirectionEnv
          )
        : inheritedRtl;

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

      // A real Control gets its own canvas item and composes independently
      // from here (`ControlCanvasWalker`'s own group), so its descendants
      // start a fresh accumulation; a skipped node folds its own CanvasItem
      // transform (if any) into what its descendants inherit instead.
      const childSkippedAncestors = isControl ? null : nextSkippedAncestors(collapsed, skippedAncestors);
      // `NOTIFICATION_ENTER_CANVAS`'s climb is `while (!node->is_set_as_top_level())`
      // (`control.cpp:3876`), so the flag ends it wherever it appears — on the
      // Control itself, before the loop runs at all, or on a CanvasItem the
      // climb would otherwise have passed through.
      const topLevel = isTopLevelItem(collapsed);
      // A real Control ends the climb (`control.cpp:3883-3886`); a CanvasItem
      // continues it unchanged; anything else is the break itself.
      const childCanvasChainBroken = isControl
        ? false
        : !isCanvasItem(collapsed) || topLevel || canvasChainBroken;
      const hidden = ancestorHidden || hiddenNodePaths.has(path);
      // Already filtered by `isSortableChild` when the parent built the map.
      const writtenVisible = childVisibility?.get(node);
      const live =
        writtenVisible === undefined
          ? collapsed
          : { ...collapsed, properties: { ...collapsed.properties, visible: writtenVisible } };
      // A CanvasLayer is a canvas of its own, so its roots are indexed by its
      // OWN counter (`canvas_layer.cpp:261-267`) over its own children.
      // From `live`, not `collapsed`: a container that WROTE its child's
      // `visible` (`ChildVisibilityFn`) did so before anything read the flag,
      // so the page's own subtree inherits the written value.
      const childParentVisible = childParentVisibleInTree(
        collapsed,
        (live.properties as ControlProperties).visible !== false,
        parentVisibleInTree
      );
      const childVisibilityFn = isControl ? controlSolverRegistry.childVisibility(collapsed.type) : undefined;
      const writtenChildVisibility = childVisibilityFn
        ? resolveChildVisibility(childVisibilityFn, collapsed, groups)
        : undefined;
      // A CanvasLayer is a canvas of its own, so its roots are indexed by its
      // OWN counter (`canvas_layer.cpp:261-267`) over its own children.
      const childCanvasRoots = isCanvasLayerType(collapsed.type)
        ? canvasRootRanges(inlineChildren, allocated.children)
        : canvasRoots;

      // Each group walks with the slice of ranges belonging to ITS children.
      // Both allocations are over flattened lists, so the slices are handed
      // back out in the order they were taken.
      const children: SolveNode[] = [];
      const childHoisted: SolveNode[] = [];
      let takenInline = 0;
      let takenInjected = 0;
      for (const group of groups) {
        const count = group.children.length;
        const groupRanges = injected(group.origin)
          ? injectedRanges.slice(takenInjected, (takenInjected += count))
          : allocated.children.slice(takenInline, (takenInline += count));
        const walked = walk(
          group.children,
          path,
          group.scope,
          nodeThemeChain,
          groupRanges,
          childSkippedAncestors,
          childCanvasChainBroken,
          hidden,
          childParentVisible,
          childCanvasRoots,
          rtl,
          writtenChildVisibility
        );
        children.push(...walked.nodes);
        childHoisted.push(...walked.hoisted);
      }

      if (isControl) {
        const themeScope = themeResolutionScope(
          collapsed.type,
          (collapsed.properties as ControlProperties).themeTypeVariation,
          nodeThemeChain,
          projectTheme
        );
        const themedIcons = resolveThemedIcons(collapsed, ownScope, themeScope);
        const texture = resolveTextureSize(
          collapsed,
          ownScope.externalResources,
          ownScope.internalResources,
          themedIcons
        );
        // A canvas boundary IS the canvas every chain broken below it parents
        // to, so it adopts those; every other Control passes them further up.
        const isBoundary = controlSolverRegistry.isCanvasBoundary(collapsed.type);
        const solved: SolveNode = {
          path,
          node: live,
          children: isBoundary ? [...children, ...childHoisted] : children,
          paintRange,
          paintSequence: allocated.self,
          // `CanvasLayer` is `isControl` (it needs the whole-viewport solve —
          // `controlRectSolver.ts`'s canvas-boundary rect) but is not a
          // `CanvasItem` at all: it renders on its OWN canvas, entirely
          // independent of any ancestor's transform (`canvas_item.cpp:263-267`
          // parents a CanvasLayer's children at `canvas_layer->get_canvas()`,
          // never at a climbed CanvasItem ancestor). Forced `null` here so an
          // ancestor Node2D never rotates a CanvasLayer's whole canvas.
          // A top_level Control's own canvas item parents at the canvas
          // (`canvas_item.cpp:565-571`), so no skipped ancestor composes onto
          // it — unlike a Control merely hoisted for anchoring, whose item
          // still hangs under the CanvasItem above it.
          skippedAncestors: isBoundary || topLevel ? null : skippedAncestors,
          // Unconditional, unlike `skippedAncestors` beside it: `top_level` and
          // a broken chain both reset the canvas facets and neither resets
          // this one (`SolveNode.parentVisibleInTree`).
          parentVisibleInTree,
          rtl: rtl ?? layoutDirectionEnv.rootRtl,
          hidden,
          styleBoxes: resolveStyleBoxes(collapsed, ownScope, themeScope),
          textureSize: texture.size,
          textureSlots: texture.slots,
          fontOverrides: resolveFontOverrides(collapsed, ownScope.externalResources, ownScope.internalResources),
          colors: resolveThemedColors(collapsed, themeScope),
          constants: resolveThemedConstants(collapsed, themeScope),
          icons: themedIcons,
          resources: ownScope,
          themeChain: nodeThemeChain,
          projectTheme,
        };
        (canvasChainBroken || topLevel ? hoisted : out).push(solved);
        if (!isBoundary) hoisted.push(...childHoisted);
      } else {
        // Not a genuine Control type — transparent passthrough (see module doc):
        // no SolveNode of its own, its Control descendants promote up instead.
        out.push(...children);
        hoisted.push(...childHoisted);
      }
    }
    return { nodes: out, hoisted };
  }

  const rootRanges = allocatePaintRange(WHOLE_CANVAS_RANGE, nodes).children;
  const walked = walk(
    nodes,
    '',
    { externalResources, internalResources },
    [],
    rootRanges,
    null,
    false,
    false,
    true,
    canvasRootRanges(nodes, rootRanges),
    inheritedRtl,
    undefined
  );
  // The viewport's own canvas is the last adopter — `_enter_canvas` finds no
  // CanvasLayer above and parents at `find_world_2d()->get_canvas()`
  // (`canvas_item.cpp:265-267`).
  return {
    tree: [...walked.nodes, ...walked.hoisted],
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
  internalResources: readonly TscnInternalResource[],
  /**
   * `Control::is_layout_rtl()`'s answer for the nearest ancestor Control or
   * Window ABOVE this forest, or `null` where there is none — the default,
   * and the only right value for a scene's own roots.
   *
   * A forest walked for a `SubViewport`'s children is the case that is not
   * `null`: the climb casts each ancestor to `Control`, then to `Window`, then
   * takes `get_parent()` (`control.cpp:3584-3598`), and a `SubViewport` is a
   * `Viewport` and neither — so it is stepped over and whatever Control
   * encloses it decides. The caller knows that Control; this walk starts below
   * the viewport and cannot see it.
   */
  inheritedRtl: boolean | null = null
): UseBuildSolveTreeResult {
  const loader = useResourceLoader();
  const hiddenNodePaths = useOptionalSelection()?.hiddenNodePaths ?? NO_HIDDEN;
  const [generation, setGeneration] = useState(0);
  // `gui/theme/custom` — the project's default theme, the last rung of the
  // ancestor walk before the built-in default (`ProjectSettingsContext`'s
  // safe-default value has no `settings`, so this is `undefined` without a
  // provider, matching every other un-set project setting).
  const projectSettings = useProjectSettings().settings;
  const projectThemeRef = projectSettings?.['gui/theme/custom']?.trim() || undefined;
  // `internationalization/*`, reduced to the booleans `is_layout_rtl` branches on.
  const layoutDirectionEnv = useMemo(
    () => projectLayoutDirectionEnv(projectSettings),
    [projectSettings]
  );

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
        hiddenNodePaths,
        layoutDirectionEnv,
        inheritedRtl
      ),
    // `generation` is an intentional cache-buster: it increments each time a
    // scene/texture/resource-file/theme/font load or failure lands so the
    // walk re-derives against the loader's now-different cache snapshot. Its
    // value is not read inside the callback — mirrors `useLiveSceneTree.ts`'s
    // identical `version` pattern.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      nodes,
      externalResources,
      internalResources,
      loader,
      projectThemeRef,
      hiddenNodePaths,
      layoutDirectionEnv,
      inheritedRtl,
      generation,
    ]
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
