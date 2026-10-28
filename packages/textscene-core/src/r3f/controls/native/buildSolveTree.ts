/**
 * `useBuildSolveTree` turns a Control subtree into the `SolveNode` forest `controlRectSolver.ts`
 * consumes, on `liveSceneTree.ts`'s shared traversal (`LiveTree.fold`). A non-Control ancestor
 * (not in `TWO_D_UI_TYPES`) gets no `SolveNode`, and its children are walked in its place. Where a
 * Control beneath it lands follows Godot's canvas climb, as `buildSolveTree.md` sets out.
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */

import { useEffect, useMemo, useRef } from 'react';
import type { TscnExternalResource, TscnInternalResource, TscnNode } from '../../../parser/types';
import type { ControlProperties } from '../../../nodes/2d/ui/control/types';
import type { Node2DProperties } from '../../../nodes/base/node2d/types';
import { perObject } from '../../../utils/perObject';
import { descendsFromClass } from '../../../godot/classdb/classBaseTypes';
import { resolveLayoutRtl, type LayoutDirectionEnv } from '../../../godot/scene/control.js';
import { projectLayoutDirectionEnv, type ProjectSettings } from '../../../parser/projectSettingsParser';
import {
  findExtResource,
  findSubResource,
  parseResourceReference,
  resolveExtResourceFilePath,
  resolveTexture2DPath,
  parsedResourcePath,
  unwrapCanvasTextureRef,
} from '../../../resources/SubResourceResolver';
import { useResourceLoader } from '../../../resources/useResource';
import { useCacheVersion } from '../../../resources/useCacheVersion';
import type { ResourceType } from '../../../resources/ResourceEventBus';
import { extResourceTexture2DSize, inlineTexture2DSize } from '../../../resources/useTexture2D';
import type { ResourceLoader } from '../../../resources/ResourceLoader';
import { resolveInlineFontResource } from '../../../resources/fonts/font/decode';
import { resolveProjectFonts } from '../../../resources/fonts/font/projectFonts';
import type { FontCacheReader, FontResource } from '../../../resources/fonts/font/types';
import { resolveInlineThemeResource } from '../../../resources/styles/theme/decode';
import type { ThemeResource } from '../../../resources/styles/theme/types';
import {
  labelSettingsFromResource,
  resolveLabelSettings,
} from '../../../resources/styles/labelsettings/decode';
import type { LabelSettingsResource } from '../../../resources/styles/labelsettings/types';
import type { LabelProperties } from '../../../nodes/2d/ui/label/types';
import {
  mergeThemedRecord,
  themeResolutionScope,
  type ThemeResolutionScope,
} from '../../../resources/styles/theme/lookup';
import { useSceneFontSettleCount } from './text/useSceneFontSettleCount';
import { useProjectSettings } from '../../contexts/ProjectSettingsContext';
import { useOptionalSelection } from '../../contexts/SelectionContext';
import {
  isInjected,
  liveTreeOf,
  type CachedSceneSource,
  type LiveChildGroup,
  type LiveTreeContext,
  type LiveLink,
  type SceneScope,
} from '../../liveSceneTree';
import { NOTHING_CACHED, recordingReads } from '../../cacheSources';
import { scopeOf } from '../../../resources/liveNode';
import { isViewportBoundary } from '../../../nodes/viewport/subviewport/viewportBoundary';
import { TWO_D_UI_TYPES } from '../has2DUIContent';
import { controlSolverRegistry, type ChildVisibilityFn } from './solverRegistry';
import type { SkippedAncestors, SolveNode, ThemedIconRef } from './solveTree';
import { ROOT_TEXTURE_SAMPLER, inheritTextureSampler } from '../../canvasItemTextureSampler';
import { multiplyTransform2D } from '../../../godot/math/transform2d.js';
import { liveNodePatches } from '../../liveNodePatches';
import { liveScenePassResults } from '../../liveScenePass';
import { patchedNode, type NodePatches } from '../../nodePatch';
import { node2DLocalTransform } from '../../node2dTransform';
import { multiplyModulate, WHITE_MODULATE } from '../../canvasItemModulate';
import {
  allocatePaintRange,
  canvasRootRanges,
  internalFrontRoom,
  isCanvasLayerType,
  isTopLevelItem,
  WHOLE_CANVAS_RANGE,
  type PaintRange,
} from '../../canvasPaintOrder';
import { parseStyleBox, type ResolvedStyleBox } from './parseStyleBox';
import type { Rgba } from '../../../godot/math/math.js';
import type { Vector2 } from '../../../godot/math/vector.js';

interface UseBuildSolveTreeResult {
  /** Every Control whose canvas item parents at the viewport's canvas: scene roots, promoted, hoisted and `top_level` Controls. */
  tree: readonly SolveNode[];
  /** Bumps on every load or failure and on settled font metrics: a stable dependency for a consumer's memo. */
  generation: number;
}

/** No ancestor or project theme: `mergeThemedRecord` returns the seed unchanged. */
const NO_THEME_SCOPE: ThemeResolutionScope = {
  typeChain: [],
  searchOrder: [],
  projectDefaultFont: null,
  variationBaseFont: null,
};

/**
 * A theme's `styles` refs, resolved against that theme's own sub-resource pool,
 * never the querying node's: a Theme's StyleBoxes live in the theme file. Keyed by
 * the `ThemeResource` object, which every referencing node shares.
 */
const resolvedStylesOfTheme = perObject(
  (theme: ThemeResource): Readonly<Record<string, Readonly<Record<string, ResolvedStyleBox>>>> => {
    const { externalResources, internalResources } = theme.resources ?? {
      externalResources: [],
      internalResources: [],
    };
    const out: Record<string, Record<string, ResolvedStyleBox>> = {};
    for (const [type, byName] of Object.entries(theme.styles ?? {})) {
      for (const [name, ref] of Object.entries(byName)) {
        const resolved = parseStyleBox(ref, externalResources, internalResources);
        if (resolved) (out[type] ??= {})[name] = resolved;
      }
    }
    return out;
  }
);

/**
 * Every StyleBox slot, keyed as `Control::get_theme_stylebox` keys them. A
 * `theme_override_styles/*`, resolved in the node's own `scope`, wins over the
 * theme chain. An unresolvable ref is omitted, and all four StyleBox kinds are
 * kept: each wraps a `StyleBoxFlatData` core with its own `contentMargin`.
 */
function resolveStyleBoxes(
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
 * Every theme colour, keyed as `Control::get_theme_color` keys them: a
 * `theme_override_colors/*` wins with no validity gate, else the theme chain.
 */
function resolveThemedColors(
  node: TscnNode,
  themeScope: ThemeResolutionScope
): Readonly<Record<string, Rgba>> {
  const local = (node.properties as ControlProperties).themeOverrideColors ?? {};
  return mergeThemedRecord(themeScope, local, (theme) => theme.colors);
}

/**
 * The constant counterpart of `resolveThemedColors` (`Control::get_theme_constant`).
 * A Theme's `<Type>/constants/<name>` is an unscaled int. Only a painter's own
 * built-in fallback on a miss is scaled.
 */
function resolveThemedConstants(
  node: TscnNode,
  themeScope: ThemeResolutionScope
): Readonly<Record<string, number>> {
  const local = (node.properties as ControlProperties).themeOverrideConstants ?? {};
  return mergeThemedRecord(themeScope, local, (theme) => theme.constants);
}

/**
 * A theme's `icons` refs, each paired with that theme's scope and cached per
 * theme like `resolvedStylesOfTheme`. Left unresolved: loading a texture needs a
 * `useTexture2D` subscription only a component can hold.
 */
const iconRefsOfTheme = perObject(
  (theme: ThemeResource): Readonly<Record<string, Readonly<Record<string, ThemedIconRef>>>> => {
    const resources = theme.resources ?? { externalResources: [], internalResources: [] };
    const out: Record<string, Record<string, ThemedIconRef>> = {};
    for (const [type, byName] of Object.entries(theme.icons ?? {})) {
      for (const [name, ref] of Object.entries(byName)) {
        (out[type] ??= {})[name] = { ref, resources };
      }
    }
    return out;
  }
);

/**
 * `Control::get_theme_icon`'s override-then-chain walk. A local
 * `theme_override_icons/<name>` ref carries the node's own `scope`, and a Theme's
 * `<Type>/icons/<name>` carries that theme's scope.
 */
function resolveThemedIcons(
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
 * One node's output in the forest walk. `hoisted` holds Controls whose `CanvasItem` chain
 * broke below (`control.cpp:3874-3890`), which Godot parents at the enclosing
 * canvas (`canvas_item.cpp:234-285`). They pass every Control above until a canvas
 * boundary or the forest root adopts them.
 */
interface WalkResult {
  nodes: SolveNode[];
  hoisted: SolveNode[];
}

const NOTHING_WALKED: WalkResult = { nodes: [], hoisted: [] };

/** The outputs of siblings, in order. */
function joinWalked(results: readonly WalkResult[]): WalkResult {
  const joined: WalkResult = { nodes: [], hoisted: [] };
  for (const result of results) {
    // Pushed one by one: a spread of a very large array exceeds the engine's argument limit.
    for (const node of result.nodes) joined.nodes.push(node);
    for (const node of result.hoisted) joined.hoisted.push(node);
  }
  return joined;
}

/** What a node hands the walk of its children, who each read the part that concerns them. */
interface Ancestry {
  themeChain: readonly ThemeResource[];
  /** Where each child draws, by the child as authored. */
  paintRanges: ReadonlyMap<TscnNode, PaintRange>;
  /** What every skipped Node2D ancestor since the last real Control or root contributes. */
  skippedAncestors: SkippedAncestors | null;
  /**
   * Whether a non-`CanvasItem` link sits between here and the nearest Control,
   * so the climb ends with `has_parent_control == false` (`control.cpp:3874-3890`).
   * A Control under one is a canvas root, and hoists.
   */
  canvasChainBroken: boolean;
  /**
   * The eye toggle of every ancestor, by outliner subtree, so it never resets.
   * A skipped ancestor has no group to hide, and a hoisted Control leaves its
   * ancestor's group, so both would escape the toggle.
   */
  ancestorHidden: boolean;
  /**
   * `CanvasItem::parent_visible_in_tree` for the children. Unlike `ancestorHidden`, it
   * resets at a `CanvasLayer` and at every non-CanvasItem parent.
   */
  parentVisibleInTree: boolean;
  /**
   * Where each root of the enclosing canvas draws: its pre-order rank among the
   * roots, not its nesting slot (`canvasRootRanges`). A node in the map takes
   * that run instead of its parent's.
   */
  canvasRoots: ReadonlyMap<TscnNode, PaintRange>;
  /**
   * The nearest ancestor Control's `is_layout_rtl()`, or `null` off the top of
   * the tree (`scene/gui/control.cpp:3584-3608`). Other types pass it through: the
   * climb steps over them. No `Window`, the one other stop, is drawn here.
   */
  inheritedRtl: boolean | null;
  /**
   * The parent's `resolveChildVisibility` map, `undefined` where the container
   * writes none. Applied as a property write, as Godot's is, so every reader of
   * `visible` honours it.
   */
  childVisibility: ReadonlyMap<TscnNode, boolean> | undefined;
}

/**
 * Where each child draws, by the child, from the allocations that numbered the lists in order.
 * One parent never lists a node object twice: the parser builds an object for each heading.
 */
function paintRangesOf(...numbered: readonly (readonly [readonly TscnNode[], readonly PaintRange[]])[]) {
  const ranges = new Map<TscnNode, PaintRange>();
  for (const [children, allocated] of numbered) {
    for (const [index, child] of children.entries())
      ranges.set(child, allocated[index] ?? WHOLE_CANVAS_RANGE);
  }
  return ranges;
}

interface ForestResult {
  tree: SolveNode[];
  pendingScenes: PendingScene[];
  pendingTextures: string[];
  pendingResourceFiles: string[];
  pendingThemes: string[];
  pendingFonts: string[];
  /** Every cache key the walk read, cached or not: the keys a reload must request again. */
  readKeys: ReadonlySet<string>;
}

/**
 * Whether `Object::cast_to<CanvasItem>` accepts this non-Control node, as
 * `CanvasItem::get_parent_item()` tests (`canvas_item.cpp:565-571`). Node2D is the
 * only non-Control CanvasItem a scene can author below a Control.
 */
function isCanvasItem(node: TscnNode): boolean {
  return descendsFromClass(node.type, 'Node2D');
}

/**
 * Whether a container's `set_visible` write reaches this direct child:
 * `Container::as_sortable_control(get_child(i), IGNORE)` casts to `Control` and
 * rejects `top_level` first (`container.cpp:143-146`). `CanvasLayer`, in
 * `TWO_D_UI_TYPES`, is no Control.
 */
function isSortableChild(live: TscnNode): boolean {
  return TWO_D_UI_TYPES.has(live.type) && !isTopLevelItem(live) && !isCanvasLayerType(live.type);
}

/**
 * What a promoted Control's descendants inherit through the non-Control `collapsed`.
 * `get_parent_item()` casts only the direct parent (`scene/main/canvas_item.cpp:565-571`),
 * so Node2D chains compose, and a non-`CanvasItem` link reparents at the nearest
 * canvas (`canvas_item.cpp:246-267`): `null`, so nothing above it leaks through.
 */
function nextSkippedAncestors(
  collapsed: TscnNode,
  previous: SkippedAncestors | null
): SkippedAncestors | null {
  if (!isCanvasItem(collapsed)) return null;
  const props = collapsed.properties as Node2DProperties;
  const local = node2DLocalTransform(props);
  return {
    // `local` first, then the ancestors above it, as `get_global_transform()` composes.
    transform: previous ? multiplyTransform2D(previous.transform, local) : local,
    // `_cull_canvas_item` folds each item's `modulate` into what its children
    // inherit (`renderer_canvas_cull.cpp`); `self_modulate` stays own-pixel.
    modulate: multiplyModulate(previous?.modulate ?? WHITE_MODULATE, props.modulate ?? WHITE_MODULATE),
    // Appended, not summed: `p_z` clamps at every step and a
    // `z_relative == false` item restarts (`renderer_canvas_cull.cpp:430-434`), so
    // only the walker, which knows the ambient z, can fold it.
    z: [...(previous?.z ?? []), { zIndex: props.z_index ?? 0, zAsRelative: props.z_as_relative !== false }],
    // Own over previous, each property on its own: a PARENT_NODE link takes its parent's cache.
    sampler: inheritTextureSampler(
      { filter: props.texture_filter, repeat: props.texture_repeat },
      previous?.sampler ?? ROOT_TEXTURE_SAMPLER
    ),
  };
}

/**
 * The `parent_visible_in_tree` a node's children inherit, by the three arms of
 * `NOTIFICATION_ENTER_TREE` (`canvas_item.cpp:311-350`): a `CanvasItem` gives
 * `visible && parent_visible_in_tree` (`canvas_item.cpp:62-64`), a `CanvasLayer`
 * its own `is_visible()`, and anything else the root Window's (or a SubViewport's) `true`.
 */
function childParentVisibleInTree(
  node: TscnNode,
  ownVisible: boolean,
  parentVisibleInTree: boolean
): boolean {
  if (descendsFromClass(node.type, 'CanvasItem')) return parentVisibleInTree && ownVisible;
  if (isCanvasLayerType(node.type)) return ownVisible;
  return true;
}

/** No provider (a headless or raster walk) hides nothing. */
const NO_HIDDEN: ReadonlySet<string> = new Set();
const NO_KEYS: ReadonlySet<string> = new Set();

/**
 * The buses whose caches the walk reads. An `ExtResource(AtlasTexture)` `.tres`
 * completes on the resource bus, not the texture one.
 */
const SOLVE_TREE_BUSES: readonly ResourceType[] = ['scene', 'texture', 'resource', 'theme', 'font'];

/** The SolveNode forest for one nodes and resource-scope pair. Not a hook: `useBuildSolveTree` is. */
function buildForest(
  nodes: readonly TscnNode[],
  externalResources: readonly TscnExternalResource[],
  internalResources: readonly TscnInternalResource[],
  loader: ResourceLoader | null,
  projectSettings: ProjectSettings | null,
  hiddenNodePaths: ReadonlySet<string>,
  layoutDirectionEnv: LayoutDirectionEnv,
  inheritedRtl: boolean | null
): ForestResult {
  const pendingScenes = new Map<string, PendingScene>();
  const pendingTextures = new Set<string>();
  const pendingResourceFiles = new Set<string>();
  const pendingThemes = new Set<string>();
  const pendingFonts = new Set<string>();
  const readKeys = new Set<string>();
  const recordRead = (path: string) => readKeys.add(path);

  const sceneCache: CachedSceneSource = loader ? recordingReads(loader.scenes, recordRead) : NOTHING_CACHED;
  const ctx: LiveTreeContext = { externalResources, internalResources, sceneCache };
  const tree = liveTreeOf(nodes, ctx);
  // Read for the first Node2D above a Control, so a scene of Controls alone never runs the passes.
  let patches: NodePatches | undefined;
  const patchesOfTree = () => (patches ??= liveScenePassResults(liveNodePatches, tree));
  const textureCache = loader ? recordingReads(loader.textures, recordRead) : NOTHING_CACHED;
  const resourceCache = loader ? recordingReads(loader.resources, recordRead) : NOTHING_CACHED;
  const themeCache = loader ? recordingReads(loader.themes, recordRead) : NOTHING_CACHED;
  const fontCache: FontCacheReader = loader ? recordingReads(loader.fonts, recordRead) : NOTHING_CACHED;

  /**
   * A Control's own `theme` (`Control::get_theme()`, `scene/gui/control.h`). An
   * ExtResource goes through `loader.themes`. A SubResource decodes inline: a
   * `res://scene.tscn::id` address cannot load, since `parseTresFile` throws on a
   * `[gd_scene]` header.
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
      const path = findExtResource(ext, parsed.id)?.path;
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
    return resolveInlineThemeResource(sub.data, ext, int, fontCache, pendingFonts);
  }

  /**
   * A Label's own `label_settings` (`label.cpp:1121-1133`). An ExtResource `.tres` loads on the
   * resource bus, and a SubResource decodes inline. Null until a `.tres` arrives, as Godot draws
   * from the theme until the property holds a resource.
   */
  function resolveOwnLabelSettings(
    node: TscnNode,
    ext: readonly TscnExternalResource[],
    int: readonly TscnInternalResource[]
  ): LabelSettingsResource | null {
    const ref = (node.properties as Partial<LabelProperties>).labelSettings;
    if (!ref) return null;
    if (parseResourceReference(ref)?.type !== 'ExtResource') return resolveLabelSettings(ref, int);

    const path = parsedResourcePath(ref, ext);
    if (!path) return null;
    const cached = resourceCache.getCached(path);
    if (cached === undefined) {
      pendingResourceFiles.add(path);
      return null;
    }
    return cached && labelSettingsFromResource(cached);
  }

  /**
   * Every `theme_override_fonts/<name>` ref, in the node's own scope
   * (`scene/gui/control.cpp:3089-3093`). A declared key stays even as `null`: a
   * declared override always wins, and key presence encodes "authored"
   * (`resolveThemeFontIn`).
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

  /** The project's theme and default font, resolved once for every node. */
  const projectFonts = resolveProjectFonts(
    projectSettings,
    { themes: themeCache, fonts: fontCache },
    { themes: pendingThemes, fonts: pendingFonts }
  );

  /**
   * A Texture2D ref's pixel size, or null until known. `textureSize` and every
   * `textureSlots` entry run through it, so they never disagree on one ref.
   */
  function resolveTextureRefSize(
    ref: string,
    ext: readonly TscnExternalResource[],
    int: readonly TscnInternalResource[]
  ): Vector2 | null {
    // An inline procedural texture or a region cell states its size here, with no
    // load. This walk is no component, so it cannot call `useTexture2D`.
    const inline = inlineTexture2DSize(ref, int);
    if (inline) return inline;

    // A texture in its own resource file loads on the resource bus, not the texture
    // one: the file is a resource, not pixels.
    const unwrapped = unwrapCanvasTextureRef(ref, int);
    const resourceFile = resolveExtResourceFilePath(unwrapped, ext);
    if (resourceFile) {
      const cached = resourceCache.getCached(resourceFile);
      if (cached === undefined) {
        pendingResourceFiles.add(resourceFile);
        return null;
      }
      if (cached === null) return null;
      return extResourceTexture2DSize(cached);
    }

    // `resolveTexture2DPath`, as the painters use: it unwraps a `SubResource(...)`
    // texture too. ExtResource alone would give a painted node a (0, 0) minimum,
    // and a container would collapse it over its siblings.
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
  const EMPTY_TEXTURE_SLOTS: Readonly<Record<string, Vector2 | null>> = {};

  /**
   * `textureSize`, the one generic slot of an unregistered type (`texture` or
   * `icon`), and `textureSlots`, every slot a type's `TextureSlotsFn` names, such
   * as `TextureProgressBar`'s three layers.
   */
  function resolveTextureSize(
    node: TscnNode,
    ext: readonly TscnExternalResource[],
    int: readonly TscnInternalResource[],
    themedIcons: Readonly<Record<string, ThemedIconRef>>
  ): { size: Vector2 | null; slots: Readonly<Record<string, Vector2 | null>> } {
    const slotsFn = controlSolverRegistry.textureSlots(node.type);
    if (slotsFn) {
      const requests = slotsFn(node, themedIcons);
      const slots: Record<string, Vector2 | null> = {};
      for (const { key, ref, scope } of requests) {
        slots[key] = ref
          ? resolveTextureRefSize(ref, scope?.externalResources ?? ext, scope?.internalResources ?? int)
          : null;
      }
      // The first request stands in for `textureSize`, Godot's first-priority
      // slot for every registering type (`TextureButton`'s `texture_normal`).
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
   * The `visible` a registered container writes onto each direct sortable child,
   * keyed by the raw child. The container numbers them in one `get_child(i)` loop
   * (`tab_container.cpp:469-481`), so the count spans every group below the container.
   */
  function resolveChildVisibility(
    fn: ChildVisibilityFn,
    container: TscnNode,
    groups: readonly LiveChildGroup[]
  ): ReadonlyMap<TscnNode, boolean> {
    const sortable: { raw: TscnNode; live: TscnNode }[] = [];
    for (const group of groups) {
      for (const child of group.children) {
        const live = tree.stepOf(child, group.scope).node;
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

  /** The Control forest of one tree node: what it adds to the forest and what it hoists to the canvas. */
  function walk(
    { raw: node, step, path, group }: LiveLink,
    ancestry: Ancestry,
    descend: (ancestry: Ancestry) => WalkResult[]
  ): WalkResult {
    const {
      themeChain,
      skippedAncestors,
      canvasChainBroken,
      ancestorHidden,
      parentVisibleInTree,
      canvasRoots,
      inheritedRtl,
      childVisibility,
    } = ancestry;
    const paintRange = canvasRoots.get(node) ?? ancestry.paintRanges.get(node) ?? WHOLE_CANVAS_RANGE;
    // A SubViewport owns its own World2D (ADR-0033); its Control subtree is
    // drawn by its own viewport surface, never by the enclosing canvas.
    if (isViewportBoundary(node.type)) return NOTHING_WALKED;

    // A grafted node's instance ref names an id in the file that authored it.
    const authored = scopeOf(node, group.scope);
    const scenePath = step.instancePath;
    if (scenePath && sceneCache.getCached(scenePath) === undefined) {
      // The ExtResource too, since the load checks its type. A raw `res://`
      // instance has none to register, and is still requested.
      const parsed = node.instance ? parseResourceReference(node.instance) : null;
      const entry =
        parsed?.type === 'ExtResource' ? findExtResource(authored.externalResources, parsed.id) : undefined;
      // One path can be reached both ways in a single walk; an ExtResource already
      // recorded for it is never overwritten by a raw-path node's absent one.
      if (!pendingScenes.get(scenePath)?.ext) {
        pendingScenes.set(scenePath, { path: scenePath, ext: entry ?? null });
      }
    }

    const { node: collapsed, scope: ownScope, groups } = step;

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

    // Theme inheritance breaks at a non-Control, non-Window ancestor
    // (`ThemeOwner::propagate_theme_changed`, `scene/theme/theme_owner.cpp`),
    // though layout passes through it.
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

    // The world walk's allocation, from the same function, so the two walks'
    // sequences compare. `NodeDispatcher` numbers authored children from the
    // node's run and injected sub-scene roots from `allocated.tail`, and this
    // walk makes the same split.
    const inlineChildren = groups.filter((g) => !isInjected(g)).flatMap((g) => g.children);
    const allocated = allocatePaintRange(paintRange, inlineChildren, {
      sortsChildren: sortsChildren(collapsed),
      frontRoom: internalFrontRoom(collapsed),
    });
    const injectedChildren = groups.filter(isInjected).flatMap((g) => g.children);
    const injectedRanges = allocatePaintRange(allocated.tail, injectedChildren).children;

    // A real Control's descendants start a fresh accumulation. A skipped node
    // folds its own CanvasItem transform into what they inherit.
    // A Node2D above a Control is placed by what the live scene passes bind, such as a RemoteTransform2D.
    const placed =
      !isControl && isCanvasItem(collapsed) ? patchedNode(collapsed, patchesOfTree().get(path)) : collapsed;
    const childSkippedAncestors = isControl ? null : nextSkippedAncestors(placed, skippedAncestors);
    // The climb is `while (!node->is_set_as_top_level())` (`control.cpp:3876`),
    // so the flag ends it on the Control itself or on any CanvasItem above.
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
    // From `live`, not `collapsed`: a container wrote its child's `visible`
    // before anything read it, so the page's subtree inherits the written value.
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
    // own counter (`canvas_layer.cpp:261-267`) over its own children.
    const childCanvasRoots = isCanvasLayerType(collapsed.type)
      ? canvasRootRanges(inlineChildren, allocated.children)
      : canvasRoots;

    const { nodes: children, hoisted: childHoisted } = groups.some((g) => g.children.length > 0)
      ? joinWalked(
          descend({
            themeChain: nodeThemeChain,
            paintRanges: paintRangesOf(
              [inlineChildren, allocated.children],
              [injectedChildren, injectedRanges]
            ),
            skippedAncestors: childSkippedAncestors,
            canvasChainBroken: childCanvasChainBroken,
            ancestorHidden: hidden,
            parentVisibleInTree: childParentVisible,
            canvasRoots: childCanvasRoots,
            inheritedRtl: rtl,
            childVisibility: writtenChildVisibility,
          })
        )
      : { nodes: [], hoisted: [] };

    // Not a Control: no SolveNode, and its Control descendants promote up.
    if (!isControl) return { nodes: children, hoisted: childHoisted };

    const themeScope = themeResolutionScope(
      collapsed.type,
      (collapsed.properties as ControlProperties).themeTypeVariation,
      nodeThemeChain,
      projectFonts
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
      // A CanvasLayer draws on its own canvas (`canvas_item.cpp:263-267`), and a
      // top_level Control's item parents at the canvas (`canvas_item.cpp:565-571`),
      // so no skipped ancestor composes onto either. A merely hoisted Control's
      // item still hangs under the CanvasItem above it.
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
      labelSettings: resolveOwnLabelSettings(
        collapsed,
        ownScope.externalResources,
        ownScope.internalResources
      ),
      colors: resolveThemedColors(collapsed, themeScope),
      constants: resolveThemedConstants(collapsed, themeScope),
      icons: themedIcons,
      resources: ownScope,
      themeChain: nodeThemeChain,
      projectFonts,
    };
    const hoistedBelow = isBoundary ? [] : childHoisted;
    return canvasChainBroken || topLevel
      ? { nodes: [], hoisted: [solved, ...hoistedBelow] }
      : { nodes: [solved], hoisted: hoistedBelow };
  }

  const rootRanges = allocatePaintRange(WHOLE_CANVAS_RANGE, nodes).children;
  const walked = joinWalked(
    tree.fold(
      {
        themeChain: [],
        paintRanges: paintRangesOf([nodes, rootRanges]),
        skippedAncestors: null,
        canvasChainBroken: false,
        ancestorHidden: false,
        parentVisibleInTree: true,
        canvasRoots: canvasRootRanges(nodes, rootRanges),
        inheritedRtl,
        childVisibility: undefined,
      },
      walk
    )
  );
  // The viewport's canvas is the last adopter: `_enter_canvas` finds no
  // CanvasLayer above and parents at `find_world_2d()->get_canvas()`
  // (`canvas_item.cpp:265-267`).
  return {
    tree: [...walked.nodes, ...walked.hoisted],
    pendingScenes: [...pendingScenes.values()],
    pendingTextures: [...pendingTextures],
    pendingResourceFiles: [...pendingResourceFiles],
    pendingThemes: [...pendingThemes],
    pendingFonts: [...pendingFonts],
    readKeys,
  };
}

export function useBuildSolveTree(
  nodes: readonly TscnNode[],
  externalResources: readonly TscnExternalResource[],
  internalResources: readonly TscnInternalResource[],
  /**
   * `Control::is_layout_rtl()` for the nearest ancestor Control or Window above
   * this forest, `null` for a scene's roots. A `SubViewport`'s caller passes its
   * enclosing Control's: the climb steps over a `Viewport` (`control.cpp:3584-3598`).
   */
  inheritedRtl: boolean | null = null
): UseBuildSolveTreeResult {
  const loader = useResourceLoader();
  const hiddenNodePaths = useOptionalSelection()?.hiddenNodePaths ?? NO_HIDDEN;
  // With or without a loader: `peekSceneFontMetrics` starts font loads from the
  // solve itself and answers with the bundled fallback until the metrics settle.
  const fontMetricsVersion = useSceneFontSettleCount(true);
  // `gui/theme/custom` and `gui/theme/custom_font`, the last rungs before the built-in default. Null
  // without a provider, like every unset project setting.
  const projectSettings = useProjectSettings().settings;
  // `internationalization/*`, reduced to the booleans `is_layout_rtl` branches on.
  const layoutDirectionEnv = useMemo(() => projectLayoutDirectionEnv(projectSettings), [projectSettings]);

  const readKeys = useRef<ReadonlySet<string>>(NO_KEYS);
  const cacheVersion = useCacheVersion(loader, SOLVE_TREE_BUSES, readKeys);
  // Both counters only grow, so their sum moves whenever either does.
  const generation = fontMetricsVersion + cacheVersion;

  const forest = useMemo(
    () =>
      buildForest(
        nodes,
        externalResources,
        internalResources,
        loader,
        projectSettings,
        hiddenNodePaths,
        layoutDirectionEnv,
        inheritedRtl
      ),
    // `generation` is a cache-buster, not read inside: the loader's caches are
    // outside React's dependency graph.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      nodes,
      externalResources,
      internalResources,
      loader,
      projectSettings,
      hiddenNodePaths,
      layoutDirectionEnv,
      inheritedRtl,
      generation,
    ]
  );
  const { tree, pendingScenes, pendingTextures, pendingResourceFiles, pendingThemes, pendingFonts } = forest;
  useEffect(() => {
    readKeys.current = forest.readKeys;
  }, [forest]);

  // Requests what the walk found uncached after render, not during it, as
  // `useResource` does.
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
