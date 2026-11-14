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
import { descendsFromClass } from '../../../godot/classdb/classBaseTypes';
import { resolveLayoutRtl, type LayoutDirectionEnv } from '../../../godot/scene/control.js';
import { projectTreeSettings, type ProjectSettings } from '../../../parser/projectSettingsParser';
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
import {
  extResourceTexture2DSize,
  inlineTexture2DSize,
  type ViewportTextureSizing,
} from '../../../resources/texture2DSize';
import {
  recordingSizes,
  sizesStillAnswered,
  viewportTargetSizes,
  type ViewportSizeRead,
  type ViewportTargetSize,
} from '../../../resources/textures/viewporttexture/viewportTargetSize';
import { useViewportTextures } from '../../contexts/ViewportTextureContext';
import { useSharedLiveTree } from '../../useLiveSceneTree';
import type { ResourceLoader } from '../../../resources/ResourceLoader';
import { resolveInlineFontResource } from '../../../resources/fonts/font/decode';
import { resolveProjectFonts } from '../../../resources/fonts/font/projectFonts';
import { withDefaultFonts } from '../../../resources/fonts/font/defaultFont';
import type { FontCacheReader, FontResource } from '../../../resources/fonts/font/types';
import { resolveInlineThemeResource } from '../../../resources/styles/theme/decode';
import type { ThemeResource } from '../../../resources/styles/theme/types';
import {
  labelSettingsFromResource,
  resolveLabelSettings,
} from '../../../resources/styles/labelsettings/decode';
import type { LabelSettingsResource } from '../../../resources/styles/labelsettings/types';
import type { LabelProperties } from '../../../nodes/2d/ui/label/types';
import { themeResolutionScope, type ThemeResolutionScope } from '../../../resources/styles/theme/lookup';
import type { AwaitedFonts } from './text/settledFonts';
import { settledFontsOf, useAwaitedFontsVersion } from './text/useSettledFont';
import { useProjectSettings } from '../../contexts/ProjectSettingsContext';
import { useLayoutDirectionEnv } from '../../contexts/useLayoutDirectionEnv';
import { useOptionalSelection } from '../../contexts/SelectionContext';
import {
  liveTreeOf,
  type CachedSceneSource,
  type LiveTreeContext,
  type LiveLink,
  type LiveStep,
  type SceneScope,
} from '../../liveSceneTree';
import { NOTHING_CACHED, recordingReads } from '../../cacheSources';
import { settleDirectories } from './directoryResolution';
import { scopeOf } from '../../../resources/liveNode';
import { embedsSubwindows, mayHoldWindowBelow } from '../../../nodes/viewport/subviewport/windowEmbedder';
import {
  isEmbeddableWindow,
  isEmbeddedWindow,
  isViewportBoundary,
} from '../../../nodes/viewport/subviewport/viewportBoundary';
import type { WindowProperties } from '../../../nodes/windows/window/types';
import { NO_OWNERS, type ThemeOwner } from '../../../nodes/windows/window/themeOwners';
import { TWO_D_UI_TYPES } from '../has2DUIContent';
import { controlSolverRegistry, type BuiltIconsFn, type TextureSlotRequest } from './solverRegistry';
import { canvasItemPass, type CanvasItemPassResult } from '../../canvasItemPass/canvasItemPass';
import {
  CHAIN_START_INHERITANCE,
  type CanvasInheritance,
  type CanvasItemLink,
} from '../../canvasItemPass/inheritedCanvasState';
import { canvasTransformBetween } from '../../canvasItemPass/canvasTransformBetween';
import { parentPathOf } from '../../../utils/nodePath';
import type { Transform2DColumns } from '../../../godot/math/transform2d';
import {
  LABEL_SETTINGS_FONT_LOADING,
  type LabelSettingsFont,
  type SolveNode,
  type ThemedIconRef,
} from './solveTree';
import { liveScenePassResults } from '../../liveScenePass';
import { isTopLevelItem, WHOLE_CANVAS_RANGE, type PaintRange } from '../../canvasPaintOrder';
import { canvasPaintPassFrom, WINDOW_CANVAS_PAINT } from '../../canvasItemPass/canvasItemPaint';
import {
  builtControlIcons,
  resolveStyleBoxes,
  resolveThemedColors,
  resolveThemedConstants,
  resolveThemedIcons,
} from './themeItems';
import type { Vector2 } from '../../../godot/math/vector.js';

interface UseBuildSolveTreeResult {
  /** Every Control whose canvas item parents at the viewport's canvas: scene roots, promoted, hoisted and `top_level` Controls. */
  tree: readonly SolveNode[];
  /** Bumps on every load or failure and on settled font metrics: a stable dependency for a consumer's memo. */
  generation: number;
  /**
   * The windows this viewport embeds, in pre-order, which is the order each registers in
   * (`viewport.cpp:308-341`). None for a viewport that embeds no windows: the embedder above draws
   * a window below it, or the window is native.
   */
  windows: readonly SolveNode[];
}

/** A LabelSettings font with the default fonts under it, as a theme font takes them, once it has loaded. */
function withSettingsDefaultFonts(font: LabelSettingsFont, scope: ThemeResolutionScope): LabelSettingsFont {
  return font === LABEL_SETTINGS_FONT_LOADING ? font : withDefaultFonts(font, scope.defaultFonts);
}

/** A Label's `label_settings` with the font it names. */
interface OwnLabelSettings {
  settings: LabelSettingsResource | null;
  font: LabelSettingsFont;
}

const NO_LABEL_SETTINGS: OwnLabelSettings = { settings: null, font: null };

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
  /** The skipped canvas items above the children, which a Control child puts back. */
  skippedChain: SkippedChain;
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
   * The nearest ancestor Control's `is_layout_rtl()`, or `null` off the top of
   * the tree (`scene/gui/control.cpp:3584-3608`). Other types pass it through: the
   * climb steps over them. No `Window`, the one other stop, is drawn here.
   */
  inheritedRtl: boolean | null;
  /**
   * Below a window or a viewport: its Controls draw in that viewport, so the walk only looks for the
   * windows that still reach this forest's embedder.
   */
  windowsOnly: boolean;
  /** The forest's window root (`ForestStart.viewport`): a Control here, never a viewport boundary. */
  isContentRoot: boolean;
}

interface ForestResult {
  tree: SolveNode[];
  windows: SolveNode[];
  pendingScenes: PendingScene[];
  pendingTextures: string[];
  pendingResourceFiles: string[];
  pendingThemes: string[];
  pendingFonts: string[];
  pendingDirectories: string[];
  /** Every cache key the walk read, cached or not: the keys a reload must request again. */
  readKeys: ReadonlySet<string>;
  /** The fonts this forest's solve and painters read while they loaded. It grows as they read. */
  awaitedFonts: AwaitedFonts;
  /** Every viewport size the walk read: a publish that answers each the same leaves the forest. */
  viewportSizeReads: readonly ViewportSizeRead[];
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
 * The live paths that bound the skipped canvas items above a node: from below `above`, the nearest
 * Control or the forest's top, down to `parent`. A null `parent` is a parent that is a Control or no
 * canvas item, so nothing is skipped.
 */
interface SkippedChain {
  above: string | null;
  parent: string | null;
}

const NOTHING_SKIPPED: SkippedChain = { above: null, parent: null };

/** No provider (a headless or raster walk) hides nothing. */
const NO_HIDDEN: ReadonlySet<string> = new Set();
const NO_KEYS: ReadonlySet<string> = new Set();

/**
 * The buses whose caches the walk reads. An `ExtResource(AtlasTexture)` `.tres`
 * completes on the resource bus, not the texture one.
 */
const SOLVE_TREE_BUSES: readonly ResourceType[] = [
  'scene',
  'texture',
  'resource',
  'theme',
  'font',
  'directory',
];

/** What the forest starts from, which its roots cannot see above them. */
interface ForestStart {
  /** The run the forest's roots draw from. The whole canvas unless a node's own run holds the forest. */
  rootRange: PaintRange;
  /**
   * `Control::is_layout_rtl()` for the nearest ancestor Control or Window above
   * this forest, `null` for a scene's roots. A `SubViewport`'s caller passes its
   * enclosing Control's: the climb steps over a `Viewport` (`control.cpp:3584-3598`).
   */
  inheritedRtl: boolean | null;
  /**
   * The viewport whose canvas the forest draws on, or `null` for the root window's. A window is the
   * forest's one root: it lays its Controls out against its whole rect, as a canvas of its own, and
   * owns a theme like a Control. A SubViewport's forest holds its children.
   */
  viewport: TscnNode | null;
  /** The theme owners above the forest, nearest first (`viewportThemeOwners`). */
  themeOwners: readonly ThemeOwner[];
}

/** Walks below a node only for the windows that reach this forest's embedder. It adds no Control here. */
function descendForWindows(
  step: LiveStep,
  descend: (ancestry: Ancestry) => WalkResult[],
  ancestry: Ancestry
): WalkResult {
  if (mayHoldWindowBelow(step)) descend(ancestry);
  return NOTHING_WALKED;
}

/**
 * `node` with the `visible` its container writes, as a property write as Godot's is, so every reader
 * of `visible` honours it. The node itself where nothing writes it.
 */
function withWrittenVisible(node: TscnNode, visible: boolean | undefined): TscnNode {
  if (visible === undefined) return node;
  return { ...node, properties: { ...node.properties, visible } };
}

/** The SolveNode forest for one nodes and resource-scope pair. Not a hook: `useBuildSolveTree` is. */
function buildForest(
  nodes: readonly TscnNode[],
  externalResources: readonly TscnExternalResource[],
  internalResources: readonly TscnInternalResource[],
  loader: ResourceLoader | null,
  projectSettings: ProjectSettings | null,
  hiddenNodePaths: ReadonlySet<string>,
  layoutDirectionEnv: LayoutDirectionEnv,
  { inheritedRtl, viewport, themeOwners, rootRange }: ForestStart,
  viewportTargetSize: ViewportTargetSize
): ForestResult {
  const pendingScenes = new Map<string, PendingScene>();
  const pendingTextures = new Set<string>();
  const pendingResourceFiles = new Set<string>();
  const pendingThemes = new Set<string>();
  const pendingFonts = new Set<string>();
  const pendingDirectories = new Set<string>();
  const windows: SolveNode[] = [];
  const readKeys = new Set<string>();
  const recordRead = (path: string) => readKeys.add(path);
  const viewportSizeReads: ViewportSizeRead[] = [];
  const readViewportSize = recordingSizes(viewportTargetSize, viewportSizeReads);

  const sceneCache: CachedSceneSource = loader ? recordingReads(loader.scenes, recordRead) : NOTHING_CACHED;
  const ctx: LiveTreeContext = {
    externalResources,
    internalResources,
    sceneCache,
    project: projectTreeSettings(projectSettings),
  };
  const tree = liveTreeOf(nodes, ctx);
  // The paint pass numbers the world walk's draws too, so the two walks' sequences compare.
  const paints = liveScenePassResults(canvasPaintPassFrom(rootRange), tree);
  const paintAt = (path: string) => {
    const paint = paints.get(path);
    if (!paint) throw new Error(`expected the paint pass to hold ${path}, got none`);
    return paint;
  };
  const embedsWindows = embedsSubwindows(tree, viewport);

  /**
   * Written only by `skippedTransformOf`, for this walk only: the tree does not change within one.
   * Keyed by the chain's parent alone, since the walk sets one `above` for each parent.
   */
  const foldedChains = new Map<string, Transform2DColumns>();

  /**
   * What the canvas item pass binds at `path`. Undefined for a CanvasLayer or a window root, which
   * is no CanvasItem: nothing above it hides it, and no container writes its `visible`.
   */
  function canvasItemAt(path: string): CanvasItemPassResult | undefined {
    return liveScenePassResults(canvasItemPass, tree).get(path);
  }

  /**
   * The items above the Control at `path` in this walk's tree. A chain that reaches a root of the
   * tree hangs below the drawn item the walk sits in. One below a node that is no canvas item, or
   * at a `top_level` item, starts a chain (`canvas_item.cpp:235-253`, `:565-571`).
   */
  function inheritanceOf(path: string, item: CanvasItemPassResult | undefined): CanvasInheritance {
    if (!item) return CHAIN_START_INHERITANCE;
    const innermostFirst: CanvasItemLink[] = [];
    let outermost = { path, item };
    for (let at = item.parent; at !== null;) {
      const link = canvasItemAt(at);
      if (!link) break;
      innermostFirst.push({ fields: link.fields, resources: link.resources, path: at });
      outermost = { path: at, item: link };
      at = link.parent;
    }
    const hangsBelowWalk = parentPathOf(outermost.path) === null && !outermost.item.fields.isTopLevel;
    return { links: innermostFirst.reverse(), startsChain: !hangsBelowWalk };
  }

  /** The transform the skipped canvas items of `chain` put back, one fold for the sibling Controls below it. */
  function skippedTransformOf({ above, parent }: SkippedChain): Transform2DColumns | null {
    if (parent === null) return null;
    let folded = foldedChains.get(parent);
    if (!folded) {
      folded = canvasTransformBetween(liveScenePassResults(canvasItemPass, tree), above, parent);
      foldedChains.set(parent, folded);
    }
    return folded;
  }
  const textureCache = loader ? recordingReads(loader.textures, recordRead) : NOTHING_CACHED;
  const resourceCache = loader ? recordingReads(loader.resources, recordRead) : NOTHING_CACHED;
  const themeCache = loader ? recordingReads(loader.themes, recordRead) : NOTHING_CACHED;
  const fontCache: FontCacheReader = loader ? recordingReads(loader.fonts, recordRead) : NOTHING_CACHED;
  const directoryCache = loader ? recordingReads(loader.directories, recordRead) : NOTHING_CACHED;
  /** Written by `withListedFolders`, for this walk only: the cache it reads does not change within one. */
  const settledFolders = new WeakMap<TscnNode, TscnNode>();

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
   * A Label's own `label_settings` (`label.cpp:1121-1133`) and its font. An ExtResource `.tres`
   * loads on the resource bus, and a SubResource decodes inline. Null until a `.tres` arrives, as
   * Godot draws from the theme until the property holds a resource. The `font` resolves in the
   * file that wrote the settings (ADR-0051): the `.tres`'s own tables, or the node's scope.
   */
  function resolveOwnLabelSettings(
    node: TscnNode,
    ext: readonly TscnExternalResource[],
    int: readonly TscnInternalResource[]
  ): OwnLabelSettings {
    const ref = (node.properties as Partial<LabelProperties>).labelSettings;
    if (!ref) return NO_LABEL_SETTINGS;
    if (parseResourceReference(ref)?.type !== 'ExtResource') {
      return withSettingsFont(resolveLabelSettings(ref, int), ext, int);
    }

    const path = parsedResourcePath(ref, ext);
    if (!path) return NO_LABEL_SETTINGS;
    const cached = resourceCache.getCached(path);
    if (cached === undefined) {
      pendingResourceFiles.add(path);
      return NO_LABEL_SETTINGS;
    }
    if (!cached) return NO_LABEL_SETTINGS;
    return withSettingsFont(labelSettingsFromResource(cached), cached.extResources, cached.subResources);
  }

  function withSettingsFont(
    settings: LabelSettingsResource | null,
    ext: readonly TscnExternalResource[],
    int: readonly TscnInternalResource[]
  ): OwnLabelSettings {
    if (!settings) return NO_LABEL_SETTINGS;
    const stillLoading = new Set<string>();
    const font = resolveInlineFontResource(settings.font, ext, int, fontCache, stillLoading);
    for (const path of stillLoading) pendingFonts.add(path);
    return { settings, font: stillLoading.size > 0 ? LABEL_SETTINGS_FONT_LOADING : font };
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

  const awaitedFonts = new Map<object, number>();
  const settledFonts = settledFontsOf(loader).recording(awaitedFonts);

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
    int: readonly TscnInternalResource[],
    consumerPath: string,
    isHeldLocally: boolean,
    sizeOfFile?: TextureSlotRequest['sizeOfFile']
  ): Vector2 | null {
    const sizing: ViewportTextureSizing = {
      isHeldLocally,
      viewportSize: (viewportTexture) => readViewportSize(consumerPath, viewportTexture),
    };
    // An inline procedural texture, a region cell or a ViewportTexture states its size here, with
    // no load. This walk is no component, so it cannot call `useTexture2D`.
    const inline = inlineTexture2DSize(ref, int, sizing);
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
      return sizeOfFile ? sizeOfFile(cached) : extResourceTexture2DSize(cached, sizing);
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

  /** The theme icons of a Control built inside a node with this scope and theme chain. */
  function builtIconsOf(scope: SceneScope, themeChain: readonly ThemeResource[]): BuiltIconsFn {
    return (type, variation) =>
      builtControlIcons({ resources: scope, themeChain, projectFonts }, type, variation);
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
    path: string,
    ownScope: SceneScope,
    themeChain: readonly ThemeResource[],
    themedIcons: Readonly<Record<string, ThemedIconRef>>
  ): { size: Vector2 | null; slots: Readonly<Record<string, Vector2 | null>> } {
    const { externalResources: ext, internalResources: int } = ownScope;
    const slotsFn = controlSolverRegistry.textureSlots(node.type);
    if (slotsFn) {
      const requests = slotsFn(node, themedIcons, builtIconsOf(ownScope, themeChain));
      const slots: Record<string, Vector2 | null> = {};
      // A node's own slot is held locally: `make_local_resource` sets it up (`packed_scene.cpp:701-704`).
      for (const { key, ref, scope, isHeldLocally = true, sizeOfFile } of requests) {
        slots[key] = ref
          ? resolveTextureRefSize(
              ref,
              scope?.externalResources ?? ext,
              scope?.internalResources ?? int,
              path,
              isHeldLocally,
              sizeOfFile
            )
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
    const size =
      typeof ref === 'string' && ref !== '' ? resolveTextureRefSize(ref, ext, int, path, true) : null;
    return { size, slots: EMPTY_TEXTURE_SLOTS };
  }

  /**
   * `themeChain` with `owner`'s own `theme` in front. A Control and a Window own a theme
   * (`ThemeOwner::propagate_theme_changed`, `scene/theme/theme_owner.cpp`).
   */
  function withOwnTheme(
    owner: TscnNode,
    scope: SceneScope,
    themeChain: readonly ThemeResource[]
  ): readonly ThemeResource[] {
    const ownTheme = resolveOwnTheme(
      (owner.properties as ControlProperties).theme,
      scope.externalResources,
      scope.internalResources
    );
    return ownTheme ? [ownTheme, ...themeChain] : themeChain;
  }

  /**
   * A viewport adds no Control to this forest. A window in it still reaches this forest's embedder
   * unless the viewport embeds it, since `Window::get_embedder` climbs past each viewport that embeds
   * none (`window.cpp`). A native window draws outside the game frame, so it is left out.
   */
  function walkViewport(
    link: LiveLink,
    ancestry: Ancestry,
    descend: (ancestry: Ancestry) => WalkResult[]
  ): WalkResult {
    if (!embedsWindows) return NOTHING_WALKED;
    const { step, path } = link;
    const live = step.node;
    const hidden = ancestry.ancestorHidden || hiddenNodePaths.has(path);
    const isWindow = isEmbeddedWindow(live.type);
    // Theme inheritance stops at a viewport that is no Window, as at any non-Control.
    const themeChain = isWindow ? withOwnTheme(live, step.scope, ancestry.themeChain) : [];
    if (isEmbeddableWindow(live)) {
      windows.push(windowSolveNode(live, path, step.scope, themeChain, hidden, ancestry.inheritedRtl));
    }
    if (embedsSubwindows(tree, live)) return NOTHING_WALKED;
    return descendForWindows(step, descend, {
      ...ancestry,
      themeChain,
      ancestorHidden: hidden,
      windowsOnly: true,
    });
  }

  /** A node's theme items by name, each resolved through `themeScope`, overrides first. */
  function themeItems(
    node: TscnNode,
    scope: SceneScope,
    themeScope: ReturnType<typeof themeResolutionScope>
  ): Pick<SolveNode, 'styleBoxes' | 'fontOverrides' | 'colors' | 'constants' | 'icons'> {
    return {
      styleBoxes: resolveStyleBoxes(node, scope, themeScope),
      fontOverrides: resolveFontOverrides(node, scope.externalResources, scope.internalResources),
      colors: resolveThemedColors(node, themeScope),
      constants: resolveThemedConstants(node, themeScope),
      icons: resolveThemedIcons(node, scope, themeScope),
    };
  }

  /** `node` settled with the folders its type lists, such as a FileDialog's. A window reaches here twice, as the embedder's entry and as the root of its own viewport. */
  function withListedFolders(node: TscnNode): TscnNode {
    const resolver = controlSolverRegistry.directoryResolver(node.type);
    if (!resolver) return node;
    const settled =
      settledFolders.get(node) ??
      settleDirectories(node, resolver, directoryCache.getCached, pendingDirectories);
    settledFolders.set(node, settled);
    return settled;
  }

  /**
   * A window as its embedder reads it: its theme items, by the class chain from its own type
   * (`Window::_update_theme_item_cache`). It draws in no canvas of this forest, so it carries no
   * paint range and no Control children.
   */
  function windowSolveNode(
    window: TscnNode,
    path: string,
    scope: SceneScope,
    themeChain: readonly ThemeResource[],
    hidden: boolean,
    inheritedRtl: boolean | null
  ): SolveNode {
    const props = window.properties as WindowProperties;
    const themeScope = themeResolutionScope(window.type, props.themeTypeVariation, themeChain, projectFonts);
    const items = themeItems(window, scope, themeScope);
    const texture = resolveTextureSize(window, path, scope, themeChain, items.icons);
    return {
      path,
      node: withListedFolders(window),
      children: [],
      paint: WINDOW_CANVAS_PAINT,
      skippedTransform: null,
      parentVisibleInTree: true,
      // A Window is no CanvasItem, so its content starts a chain.
      inheritance: CHAIN_START_INHERITANCE,
      rtl: inheritedRtl ?? layoutDirectionEnv.rootRtl,
      locale: layoutDirectionEnv.applicationLocale,
      hidden,
      ...items,
      textureSize: texture.size,
      textureSlots: texture.slots,
      labelSettings: null,
      labelSettingsFont: null,
      resources: scope,
      themeChain,
      projectFonts,
      settledFonts,
    };
  }

  /** The Control forest of one tree node: what it adds to the forest and what it hoists to the canvas. */
  function walk(
    link: LiveLink,
    ancestry: Ancestry,
    descend: (ancestry: Ancestry) => WalkResult[]
  ): WalkResult {
    const { raw: node, step, path, group } = link;
    const { themeChain, skippedChain, canvasChainBroken, ancestorHidden, inheritedRtl } = ancestry;
    const { isContentRoot } = ancestry;
    // A viewport owns its own World2D (ADR-0033): its Control subtree draws in its own target. The
    // collapsed type, since an instance's own node has none when its sub-scene root is the viewport.
    if (isViewportBoundary(step.node.type) && !isContentRoot) return walkViewport(link, ancestry, descend);
    const paint = paintAt(path);

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

    const isControl = isContentRoot || TWO_D_UI_TYPES.has(collapsed.type);

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
    const nodeThemeChain = isControl ? withOwnTheme(collapsed, ownScope, themeChain) : [];
    const hidden = ancestorHidden || hiddenNodePaths.has(path);
    if (ancestry.windowsOnly) {
      return descendForWindows(step, descend, {
        ...ancestry,
        themeChain: nodeThemeChain,
        ancestorHidden: hidden,
        inheritedRtl: rtl,
      });
    }

    // A real Control's descendants start a fresh chain. A skipped canvas item joins the chain.
    const childSkippedChain: SkippedChain = isControl
      ? { above: path, parent: null }
      : { above: skippedChain.above, parent: isCanvasItem(collapsed) ? path : null };
    // The climb is `while (!node->is_set_as_top_level())` (`control.cpp:3876`),
    // so the flag ends it on the Control itself or on any CanvasItem above.
    const topLevel = isTopLevelItem(collapsed);
    // A real Control ends the climb (`control.cpp:3883-3886`); a CanvasItem
    // continues it unchanged; anything else is the break itself.
    const childCanvasChainBroken = isControl
      ? false
      : !isCanvasItem(collapsed) || topLevel || canvasChainBroken;

    const { nodes: children, hoisted: childHoisted } = groups.some((g) => g.children.length > 0)
      ? joinWalked(
          descend({
            themeChain: nodeThemeChain,
            skippedChain: childSkippedChain,
            canvasChainBroken: childCanvasChainBroken,
            ancestorHidden: hidden,
            inheritedRtl: rtl,
            windowsOnly: false,
            isContentRoot: false,
          })
        )
      : { nodes: [], hoisted: [] };

    // Not a Control: no SolveNode, and its Control descendants promote up.
    if (!isControl) return { nodes: children, hoisted: childHoisted };

    const canvasItem = canvasItemAt(path);
    // The embedder applies a window's `visible`, so its own Controls always draw.
    const live = withWrittenVisible(collapsed, isContentRoot ? true : canvasItem?.writtenVisible);

    const themeScope = themeResolutionScope(
      collapsed.type,
      (collapsed.properties as ControlProperties).themeTypeVariation,
      nodeThemeChain,
      projectFonts
    );
    const items = themeItems(collapsed, ownScope, themeScope);
    const texture = resolveTextureSize(collapsed, path, ownScope, nodeThemeChain, items.icons);
    // A canvas boundary IS the canvas every chain broken below it parents
    // to, so it adopts those; every other Control passes them further up.
    const isBoundary = controlSolverRegistry.isCanvasBoundary(collapsed.type);
    const ownLabelSettings = resolveOwnLabelSettings(
      collapsed,
      ownScope.externalResources,
      ownScope.internalResources
    );
    const solved: SolveNode = {
      path,
      node: withListedFolders(live),
      children: isBoundary ? [...children, ...childHoisted] : children,
      paint,
      // A CanvasLayer draws on its own canvas (`canvas_item.cpp:263-267`), and a
      // top_level Control's item parents at the canvas (`canvas_item.cpp:565-571`),
      // so no skipped ancestor composes onto either. A merely hoisted Control's
      // item still hangs under the CanvasItem above it.
      skippedTransform: isBoundary || topLevel ? null : skippedTransformOf(skippedChain),
      // Unconditional, unlike `skippedTransform` beside it: `top_level` and
      // a broken chain both reset the canvas facets and neither resets
      // this one (`SolveNode.parentVisibleInTree`).
      parentVisibleInTree: canvasItem?.parentVisibleInTree ?? true,
      inheritance: inheritanceOf(path, canvasItem),
      rtl: rtl ?? layoutDirectionEnv.rootRtl,
      locale: layoutDirectionEnv.applicationLocale,
      hidden,
      ...items,
      textureSize: texture.size,
      textureSlots: texture.slots,
      labelSettings: ownLabelSettings.settings,
      labelSettingsFont: withSettingsDefaultFonts(ownLabelSettings.font, themeScope),
      resources: ownScope,
      themeChain: nodeThemeChain,
      projectFonts,
      settledFonts,
    };
    const hoistedBelow = isBoundary ? [] : childHoisted;
    return canvasChainBroken || topLevel
      ? { nodes: [], hoisted: [solved, ...hoistedBelow] }
      : { nodes: [solved], hoisted: hoistedBelow };
  }

  const ownerThemeChain = themeOwners.flatMap(({ node, scope }) => withOwnTheme(node, scope, []));
  const walked = joinWalked(
    tree.fold(
      {
        themeChain: ownerThemeChain,
        skippedChain: NOTHING_SKIPPED,
        canvasChainBroken: false,
        ancestorHidden: false,
        inheritedRtl,
        windowsOnly: false,
        isContentRoot: viewport !== null && isEmbeddedWindow(viewport.type),
      },
      walk
    )
  );
  // The viewport's canvas is the last adopter: `_enter_canvas` finds no
  // CanvasLayer above and parents at `find_world_2d()->get_canvas()`
  // (`canvas_item.cpp:265-267`).
  return {
    tree: [...walked.nodes, ...walked.hoisted],
    windows,
    pendingScenes: [...pendingScenes.values()],
    pendingTextures: [...pendingTextures],
    pendingResourceFiles: [...pendingResourceFiles],
    pendingThemes: [...pendingThemes],
    pendingFonts: [...pendingFonts],
    pendingDirectories: [...pendingDirectories],
    readKeys,
    awaitedFonts,
    viewportSizeReads,
  };
}

/** The Control forest of `nodes`: a scene's roots, a SubViewport's children, or the unowned nodes of a tile layer. */
export function useBuildSolveTree(
  nodes: readonly TscnNode[],
  externalResources: readonly TscnExternalResource[],
  internalResources: readonly TscnInternalResource[],
  /** `ForestStart.inheritedRtl`. */
  inheritedRtl: boolean | null = null,
  /** The run of draws the roots take. A tile layer's scene tiles sit among the draws of the layer's children. */
  rootRange: PaintRange = WHOLE_CANVAS_RANGE
): UseBuildSolveTreeResult {
  const start = useMemo(
    () => ({ inheritedRtl, viewport: null, themeOwners: NO_OWNERS, rootRange }),
    [inheritedRtl, rootRange]
  );
  return useSolveForest(nodes, externalResources, internalResources, start);
}

/**
 * The Control forest a viewport draws on its canvas: a SubViewport's children, or a window rooted
 * at itself (`ForestStart.viewport`).
 */
export function useBuildViewportTree(
  viewport: TscnNode,
  externalResources: readonly TscnExternalResource[],
  internalResources: readonly TscnInternalResource[],
  themeOwners: readonly ThemeOwner[],
  inheritedRtl: boolean | null = null
): UseBuildSolveTreeResult {
  const nodes = useMemo(() => (isEmbeddedWindow(viewport.type) ? [viewport] : viewport.children), [viewport]);
  const start = useMemo(
    () => ({ inheritedRtl, viewport, themeOwners, rootRange: WHOLE_CANVAS_RANGE }),
    [inheritedRtl, viewport, themeOwners]
  );
  return useSolveForest(nodes, externalResources, internalResources, start);
}

function useSolveForest(
  nodes: readonly TscnNode[],
  externalResources: readonly TscnExternalResource[],
  internalResources: readonly TscnInternalResource[],
  start: ForestStart
): UseBuildSolveTreeResult {
  const loader = useResourceLoader();
  const hiddenNodePaths = useOptionalSelection()?.hiddenNodePaths ?? NO_HIDDEN;
  // With or without a loader: `peekSceneFontMetrics` starts font loads from the solve itself and
  // answers with the bundled fallback until the metrics settle. Only a font the last build read
  // while it loaded wakes it.
  const awaitedFonts = useAwaitedFontsVersion(settledFontsOf(loader));
  // `gui/theme/custom` and `gui/theme/custom_font`, the last rungs before the built-in default. Null
  // without a provider, like every unset project setting.
  const projectSettings = useProjectSettings().settings;
  const layoutDirectionEnv = useLayoutDirectionEnv();

  const readKeys = useRef<ReadonlySet<string>>(NO_KEYS);
  const cacheVersion = useCacheVersion(loader, SOLVE_TREE_BUSES, readKeys);
  // Both counters only grow, so their sum moves whenever either does.
  const generation = awaitedFonts.version + cacheVersion;
  const viewportTargets = useViewportTextures();
  const live = useSharedLiveTree();
  const viewportTargetSize = useMemo(
    () => viewportTargetSizes(viewportTargets, live),
    [viewportTargets, live]
  );
  // The lookup the last forest was keyed on stays the key while it answers every size that forest
  // read alike, so a publish or a live-tree load no slot reads rebuilds nothing.
  const lastSizes = useRef<{ key: ViewportTargetSize; reads: readonly ViewportSizeRead[] } | null>(null);
  // Key first: an unchanged lookup answers every read alike, so a render with none re-reads nothing.
  const last = lastSizes.current;
  const sizesKey =
    last && (last.key === viewportTargetSize || sizesStillAnswered(last.reads, viewportTargetSize))
      ? last.key
      : viewportTargetSize;

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
        start,
        viewportTargetSize
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
      start,
      sizesKey,
      generation,
    ]
  );
  const {
    tree,
    pendingScenes,
    pendingTextures,
    pendingResourceFiles,
    pendingThemes,
    pendingFonts,
    pendingDirectories,
  } = forest;
  const { track: trackAwaitedFonts } = awaitedFonts;
  useEffect(() => trackAwaitedFonts(forest.awaitedFonts), [trackAwaitedFonts, forest.awaitedFonts]);
  useEffect(() => {
    readKeys.current = forest.readKeys;
    lastSizes.current = { key: sizesKey, reads: forest.viewportSizeReads };
  }, [forest, sizesKey]);

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
    for (const folder of pendingDirectories) loader.directories.request(folder);
  }, [
    loader,
    pendingScenes,
    pendingTextures,
    pendingResourceFiles,
    pendingThemes,
    pendingFonts,
    pendingDirectories,
  ]);

  return { tree, generation, windows: forest.windows };
}
