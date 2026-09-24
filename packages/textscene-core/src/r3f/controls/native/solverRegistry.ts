/**
 * The Control rect solver's per-type registry (ADR-0002, through
 * `createTypeRegistry`). Each slice registers its solver on import. An
 * unregistered type is a leaf: minimum size `(0, 0)`, and its children solve
 * as anchored Controls against its rect. No React, no THREE.
 */

import { createTypeRegistry } from '../../../core/createTypeRegistry';
import type { TscnNode } from '../../../parser/types';
import type { Rect2, Vec2 } from './rect';
import type { SolveNode, ThemedIconRef } from './solveTree';
import type { NativeTheme } from './nativeTheme';
import type { FontMetrics } from './text/fontMetrics';
import type { SealedHandoff } from './solveHandoff';

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
) => Vec2;

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
  combinedMinimumSize(n: SolveNode): Vec2;
  // A `MinimumSizeFn` that ignores `tentativeRect` has identical inputs in both
  // passes, so the same output.
  /**
   * The rect the first solve pass gave `n`, or `undefined` on the first pass.
   * A minimum size tied to the control's own `get_size()` (`TextureRect`'s
   * `EXPAND_FIT_WIDTH`/`FIT_HEIGHT`, `texture_rect.cpp:107-133`) reads it on a second
   * pass that runs only for a type registered with `registerSizeDependentMinimum`.
   */
  tentativeRect?(n: SolveNode): Rect2 | undefined;
}

/**
 * `Control::get_minimum_size` for a registered type: its own contribution,
 * before the `custom_minimum_size` floor. A value its painter also needs is a
 * share (`solveHandoff.ts`), gated here by `ctx.measureText`, not a return value.
 */
export type MinimumSizeFn = (n: SolveNode, ctx: SolveContext) => Vec2;

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
}

/**
 * `Container::fit_child_in_rect` for a registered container: from the content
 * rect (its rect minus chrome) and each child's combined minimum size, every
 * child's rect relative to the container's top-left. Returns a bare map, or a
 * `ContainerLayoutResult` when the painter needs a value; `controlRectSolver.ts` takes either.
 */
export type ContainerLayoutFn = (
  n: SolveNode,
  children: readonly { node: SolveNode; minSize: Vec2 }[],
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
}

/**
 * Which Texture2D-valued slots a type carries, given the live node and its theme
 * icons. A per-type fact on the slice, not a central list `buildSolveTree.ts`
 * would keep in sync with every Control type it walks. An unregistered type
 * keeps the single `texture` or `icon` slot.
 */
// `themedIcons` is optional because only a type with a themeable icon reads it,
// and a slice's tests call its `TextureSlotsFn` with one argument.
// `buildSolveTree.ts` always passes it.
export type TextureSlotsFn = (
  node: TscnNode,
  themedIcons?: Readonly<Record<string, ThemedIconRef>>
) => readonly TextureSlotRequest[];

/**
 * The `visible` a container writes onto one direct sortable Control child
 * while sorting. `undefined` leaves the authored flag alone. `index` and
 * `count` number the sortable children only (`tab_container.cpp:469-481`).
 */
// Per child: `FoldableContainer` writes `c->set_visible(!folded)` to every child
// (`scene/gui/foldable_container.cpp:376-386`), while `TabContainer` shows only the
// current page (`scene/gui/tab_container.cpp:377-399`, and the same split at `:290-293`).
// A promoted or `top_level` Control fails the sortable cast (`container.cpp:143-146`).
export type ChildVisibilityFn = (
  container: TscnNode,
  child: TscnNode,
  index: number,
  count: number
) => boolean | undefined;

class ControlSolverRegistry {
  private readonly minimumSizeFns = createTypeRegistry<MinimumSizeFn>('controlSolverRegistry.minimumSize');
  private readonly containerLayoutFns = createTypeRegistry<ContainerLayoutFn>(
    'controlSolverRegistry.containerLayout'
  );
  private readonly textureSlotFns = createTypeRegistry<TextureSlotsFn>('controlSolverRegistry.textureSlots');
  private readonly childVisibilityFns = createTypeRegistry<ChildVisibilityFn>(
    'controlSolverRegistry.childVisibility'
  );
  private readonly canvasBoundaryTypes = new Set<string>();
  private readonly sizeDependentMinimumTypes = new Set<string>();

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
   * A set, so `solveControlTree` decides on a second pass with a membership
   * test during `assignPaintIndex` rather than a traversal of its own.
   */
  registerSizeDependentMinimum(typeName: string): void {
    this.sizeDependentMinimumTypes.add(typeName);
  }

  /** Whether this type's `MinimumSizeFn` reads `SolveContext.tentativeRect` (see `registerSizeDependentMinimum`). */
  isSizeDependentMinimum(typeName: string): boolean {
    return this.sizeDependentMinimumTypes.has(typeName);
  }

  registerContainerLayout(typeName: string, fn: ContainerLayoutFn): void {
    this.containerLayoutFns.register(typeName, fn);
  }

  registerTextureSlots(typeName: string, fn: TextureSlotsFn): void {
    this.textureSlotFns.register(typeName, fn);
  }

  /** Declares a container that writes its children's `visible` (see `ChildVisibilityFn`). */
  registerChildVisibility(typeName: string, fn: ChildVisibilityFn): void {
    this.childVisibilityFns.register(typeName, fn);
  }

  /**
   * This type's `ChildVisibilityFn`, or `undefined`. Returned, not invoked: the
   * caller enumerates the sortable children first, and only for a registered type.
   */
  childVisibility(typeName: string): ChildVisibilityFn | undefined {
    return this.childVisibilityFns.get(typeName);
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
    this.textureSlotFns.clear();
    this.childVisibilityFns.clear();
    this.canvasBoundaryTypes.clear();
    this.sizeDependentMinimumTypes.clear();
  }
}

export const controlSolverRegistry = new ControlSolverRegistry();
