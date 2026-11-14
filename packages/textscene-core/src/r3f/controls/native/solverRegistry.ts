/**
 * The Control rect solver's per-type registry (ADR-0002, through
 * `createTypeRegistry`). Each slice registers its solver on import. An
 * unregistered type is a leaf: minimum size `(0, 0)`, and its children solve
 * as anchored Controls against its rect. No React, no THREE.
 */

import { createTypeRegistry } from '../../../core/createTypeRegistry';
import type { TscnNode } from '../../../parser/types';
import type { Rect2 } from '../../../godot/math/rect2';
import type { SolveNode, ThemedIconRef } from './solveTree';
import type { NativeTheme } from './nativeTheme';
import type { FontMetrics } from './text/fontMetrics';
import type { SealedHandoff } from './solveHandoff';
import type { SolvedControl } from './controlRectSolver';
import type { Vector2 } from '../../../godot/math/vector';
import type { ParsedResource } from '../../../parser/parsedResource';
import type { DirectoryListings } from '../../../resources/directoryListing';

/**
 * Measures a run of text at a font size. `lineSpacingPx` is the caller's own
 * theme constant (Label's 3), applied between lines only, and defaults to 0,
 * Godot's `font->get_height()`. A single line measures exactly the font height.
 */
// `fontMetrics` is the `FontMetrics` the caller's painter draws with
// (`text/resolveNodeFontMetrics.ts`), so the minimum size floors in the painted
// font. Omitted, it is `measurer.ts`'s `OPEN_SANS_FONT_METRICS`.
export type TextMeasurer = (
  text: string,
  fontSize: number,
  lineSpacingPx?: number,
  fontMetrics?: FontMetrics
) => Vector2;

export interface SolveContext {
  /** The scaled default theme, plain data. */
  theme: NativeTheme;
  /**
   * `null` where no text engine is wired. A function that needs text metrics
   * then treats the text as contributing nothing, and does not throw.
   */
  measureText: TextMeasurer | null;
  /**
   * `Control::get_combined_minimum_size` for any node: the type's `MinimumSizeFn`
   * (or `(0, 0)`) floored up to `custom_minimum_size`. A container's
   * `MinimumSizeFn` recurses through this, the one function `solveControlTree` uses.
   */
  combinedMinimumSize(n: SolveNode): Vector2;
  // A `MinimumSizeFn` that ignores `tentativeRect` has identical inputs in both
  // passes, so the same output.
  /**
   * The rect the first solve pass gave `n`, or `undefined` on the first pass.
   * A minimum size tied to the control's own `get_size()` (`TextureRect`'s
   * `EXPAND_FIT_WIDTH`/`FIT_HEIGHT`, `texture_rect.cpp:107-133`) reads it on a second
   * pass that runs only for a type registered with `registerSizeDependentMinimum`.
   */
  tentativeRect?(n: SolveNode): Rect2 | undefined;
  /**
   * The visible size of the viewport that embeds the window being wrapped
   * (`Window::get_usable_parent_rect`, `window.cpp:2326-2340`), which a popup's contents minimum
   * limits its height to. Absent outside a window wrap, where nothing limits it.
   */
  embedderSize?: Vector2;
}

/**
 * `Control::get_minimum_size` for a registered type: its own contribution,
 * before the `custom_minimum_size` floor. A value its painter also needs is a
 * share (`solveHandoff.ts`), gated here by `ctx.measureText`, not a return value.
 */
export type MinimumSizeFn = (n: SolveNode, ctx: SolveContext) => Vector2;

/** Whether a node of a size-dependent type reads `SolveContext.tentativeRect` (`registerSizeDependentMinimum`). */
export type SizeDependentPredicate = (n: SolveNode) => boolean;

/**
 * The contents minimum a window's own properties give when its `size` is applied at load, before its
 * Controls and the tree exist (`Window::set_size` clamps in `_update_window_size`, `window.cpp:1183-1190`),
 * or `null` where it sets none.
 */
export type LoadedMinimumSizeFn = (n: SolveNode, ctx: SolveContext) => Vector2 | null;

/** A `ContainerLayoutFn`'s result when it also seals a solve handoff for its own painter. */
export interface ContainerLayoutResult {
  /** Every child's rect. */
  rects: ReadonlyMap<string, Rect2>;
  /**
   * Solve output the painter cannot reach, such as a split's `computed_split_offset`,
   * sealed by a channel (`solveHandoff.ts`). It surfaces unchanged on
   * `SolvedControl.meta` and `NativeControlComponentProps.meta`.
   */
  meta?: SealedHandoff;
  /**
   * The scale the layout writes onto a child, by path, such as GraphEdit's `set_scale(zoom, zoom)`.
   * It replaces the child's authored scale. A child without an entry keeps its own.
   */
  childScales?: ReadonlyMap<string, Vector2>;
  /**
   * False when `Container::fit_child_in_rect` never runs, as in GraphEdit (`graph_edit.h:114`),
   * a plain `Control` that only places its children: each child then keeps its own rotation and
   * scale, except the `childScales` entry. Defaults to true.
   */
  resetsChildTransform?: boolean;
}

/**
 * `Container::fit_child_in_rect` for a registered container: from the content
 * rect (its rect minus chrome) and each child's combined minimum size, every
 * child's rect relative to the container's top-left. Returns a bare map, or a
 * `ContainerLayoutResult` when the painter needs a value; `controlRectSolver.ts` takes either.
 */
export type ContainerLayoutFn = (
  n: SolveNode,
  children: readonly { node: SolveNode; minSize: Vector2 }[],
  contentRect: Rect2,
  ctx: SolveContext
) => ReadonlyMap<string, Rect2> | ContainerLayoutResult;

/**
 * One Texture2D-valued property a node's type wants sized. `buildSolveTree.ts`
 * resolves every `ref` the same way (inline, `.tres` AtlasTexture, or a loaded
 * file), so a ref answers the same whatever the number of slots.
 */
export interface TextureSlotRequest {
  /**
   * The key in `SolveNode.textureSlots`: a Godot property name for a fixed slot
   * (`TextureProgressBar`'s `texture_under`), or the raw ref for a request built
   * from content (`RichTextLabel`'s `[img]`s, one per distinct ref).
   */
  key: string;
  /** The raw Texture2D-valued property text: an `ExtResource(...)`/`SubResource(...)`/`res://` ref. */
  ref: string;
  /**
   * The resource scope `ref` addresses, the node's own when omitted. A themed
   * icon sets it: a `<Type>/icons/<name>` ref from an ancestor or project Theme
   * addresses that theme file's sub-resource pool, never the node's.
   */
  scope?: SolveNode['resources'];
  /** Whether every resource between the node and `ref` is local to scene, true when omitted. A themed icon sets its Theme's. */
  isHeldLocally?: boolean;
  /**
   * How the slot reads a size out of the resource file `ref` names, for a slot whose file is not a
   * texture. A `VideoStreamPlayer`'s stream reports its picture size. Omitted, the file is a texture resource.
   */
  sizeOfFile?: (parsed: ParsedResource) => Vector2 | null;
}

/**
 * The request for a themed icon: its ref, in its theme's scope, held as its theme holds it. A pending or failed load
 * gives `null`, and each consumer reads `textureSlots[name] ?? <default icon size>`, as `Theme::has_icon` refuses an
 * invalid icon (`theme.cpp:306`).
 */
export function themedSlotRequest(key: string, themed: ThemedIconRef): TextureSlotRequest {
  return { key, ref: themed.ref, scope: themed.resources, isHeldLocally: themed.isHeldLocally };
}

/** The requests for those of `names` that have a themed answer. */
export function themedSlotRequests(
  names: Iterable<string>,
  themedIcons: Readonly<Record<string, ThemedIconRef>>
): TextureSlotRequest[] {
  const requests: TextureSlotRequest[] = [];
  for (const name of names) {
    const themed = themedIcons[name];
    if (themed) requests.push(themedSlotRequest(name, themed));
  }
  return requests;
}

/**
 * Which Texture2D-valued slots a type carries, given the live node and its theme
 * icons. A per-type fact on the slice, not a central list `buildSolveTree.ts`
 * would keep in sync with every Control type it walks. An unregistered type
 * keeps the single `texture` or `icon` slot. `themedIcons` and `builtIcons` are
 * optional because only a type with a themeable icon reads them. `buildSolveTree.ts`
 * always passes both.
 */
export type TextureSlotsFn = (
  node: TscnNode,
  themedIcons?: Readonly<Record<string, ThemedIconRef>>,
  builtIcons?: BuiltIconsFn
) => readonly TextureSlotRequest[];

/**
 * The theme icons a Control of `type` (with its `theme_type_variation`), built inside the node and
 * never serialised, resolves through the node's theme chain. A dialog's buttons are such Controls.
 */
export type BuiltIconsFn = (type: string, variation?: string) => Readonly<Record<string, ThemedIconRef>>;

/**
 * How a type settles from the `res://` folders a host lists, such as a FileDialog's file list. `folders` names the folders to
 * ask for given the answers so far, since one answer can lead to the next. `resolve` gives the node with every answer in.
 */
export interface DirectoryResolver {
  folders(node: TscnNode, listings: DirectoryListings): readonly string[];
  resolve(node: TscnNode, listings: DirectoryListings): TscnNode;
}

/** An `INTERNAL_MODE_BACK` child a Control draws itself: its node name and its origin in the Control. */
export interface InternalBackPiece {
  readonly name: string;
  readonly origin: Vector2;
}

/**
 * The visible `INTERNAL_MODE_BACK` children of one solved Control, in the order Godot adds them. A
 * y-sort collects each as an entry of its own (`renderer_canvas_cull.cpp:110-160`).
 */
export type InternalBackPiecesFn = (solved: SolvedControl) => readonly InternalBackPiece[];

class ControlSolverRegistry {
  private readonly minimumSizeFns = createTypeRegistry<MinimumSizeFn>('controlSolverRegistry.minimumSize');
  private readonly containerLayoutFns = createTypeRegistry<ContainerLayoutFn>(
    'controlSolverRegistry.containerLayout'
  );
  private readonly textureSlotFns = createTypeRegistry<TextureSlotsFn>('controlSolverRegistry.textureSlots');
  private readonly loadedMinimumSizeFns = createTypeRegistry<LoadedMinimumSizeFn>(
    'controlSolverRegistry.loadedMinimumSize'
  );
  private readonly directoryResolvers = createTypeRegistry<DirectoryResolver>(
    'controlSolverRegistry.directoryResolver'
  );
  private readonly internalBackPiecesFns = createTypeRegistry<InternalBackPiecesFn>(
    'controlSolverRegistry.internalBackPieces'
  );
  private readonly canvasBoundaryTypes = new Set<string>();
  private readonly sizeDependentMinimumTypes = new Map<string, SizeDependentPredicate>();

  /**
   * Declares a type in the Control walk that is not a `CanvasItem`, such as
   * `CanvasLayer`. Its Controls anchor against the viewport, as
   * `Control::get_parent_anchorable_rect` does, not a degenerate `(0, 0)` rect.
   * Registry data, not a type comparison in the solver, like every per-type behaviour.
   */
  registerCanvasBoundary(typeName: string): void {
    this.canvasBoundaryTypes.add(typeName);
  }

  /** Whether this type is a non-CanvasItem canvas host (see `registerCanvasBoundary`). */
  isCanvasBoundary(typeName: string): boolean {
    return this.canvasBoundaryTypes.has(typeName);
  }

  registerMinimumSize(typeName: string, fn: MinimumSizeFn): void {
    this.minimumSizeFns.register(typeName, fn);
  }

  /**
   * Declares a type whose `MinimumSizeFn` reads `SolveContext.tentativeRect`.
   * `isDependent` narrows the type to the nodes whose minimum does read it: a Button
   * that does not wrap costs its scene no second pass.
   */
  registerSizeDependentMinimum(typeName: string, isDependent: SizeDependentPredicate = () => true): void {
    this.sizeDependentMinimumTypes.set(typeName, isDependent);
  }

  /** Whether this node's `MinimumSizeFn` reads `SolveContext.tentativeRect`: `solveControlTree` runs its second pass for one. */
  readsTentativeRect(n: SolveNode): boolean {
    return this.sizeDependentMinimumTypes.get(n.node.type)?.(n) ?? false;
  }

  registerLoadedMinimumSize(typeName: string, fn: LoadedMinimumSizeFn): void {
    this.loadedMinimumSizeFns.register(typeName, fn);
  }

  loadedMinimumSize(typeName: string): LoadedMinimumSizeFn | undefined {
    return this.loadedMinimumSizeFns.get(typeName);
  }

  registerContainerLayout(typeName: string, fn: ContainerLayoutFn): void {
    this.containerLayoutFns.register(typeName, fn);
  }

  registerTextureSlots(typeName: string, fn: TextureSlotsFn): void {
    this.textureSlotFns.register(typeName, fn);
  }

  registerDirectoryResolver(typeName: string, resolver: DirectoryResolver): void {
    this.directoryResolvers.register(typeName, resolver);
  }

  registerInternalBackPieces(typeName: string, fn: InternalBackPiecesFn): void {
    this.internalBackPiecesFns.register(typeName, fn);
  }

  /** This type's `InternalBackPiecesFn`, or `undefined` for a type that draws no such child itself. */
  internalBackPieces(typeName: string): InternalBackPiecesFn | undefined {
    return this.internalBackPiecesFns.get(typeName);
  }

  /** This type's `DirectoryResolver`, or `undefined` for a type that lists no folder. */
  directoryResolver(typeName: string): DirectoryResolver | undefined {
    return this.directoryResolvers.get(typeName);
  }

  /** This type's `TextureSlotsFn`, or `undefined` for a type that keeps the single-slot fallback. */
  textureSlots(typeName: string): TextureSlotsFn | undefined {
    return this.textureSlotFns.get(typeName);
  }

  minimumSize(typeName: string): MinimumSizeFn | undefined {
    return this.minimumSizeFns.get(typeName);
  }

  containerLayout(typeName: string): ContainerLayoutFn | undefined {
    return this.containerLayoutFns.get(typeName);
  }

  /** Test-only: drops every registration between test files. */
  clear(): void {
    this.minimumSizeFns.clear();
    this.containerLayoutFns.clear();
    this.loadedMinimumSizeFns.clear();
    this.textureSlotFns.clear();
    this.directoryResolvers.clear();
    this.internalBackPiecesFns.clear();
    this.canvasBoundaryTypes.clear();
    this.sizeDependentMinimumTypes.clear();
  }
}

export const controlSolverRegistry = new ControlSolverRegistry();
