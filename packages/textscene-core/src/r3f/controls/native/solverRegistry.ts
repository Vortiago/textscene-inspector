/**
 * The Control rect solver's per-type registry (ADR-0002's `typeName → value`
 * pattern, reused via `createTypeRegistry` exactly like
 * `ControlComponentRegistry.ts`). A type with no registration is a leaf: its
 * minimum size is `(0, 0)` and it imposes no layout on its children (they
 * solve as free/anchored Controls against its own rect). Each slice registers
 * its own solver on import.
 *
 * Pure data + functions, no React, no THREE.
 */

import { createTypeRegistry } from '../../../core/createTypeRegistry';
import type { TscnNode } from '../../../parser/types';
import type { Rect2, Vec2 } from './rect';
import type { SolveNode, ThemedIconRef } from './solveTree';
import type { NativeTheme } from './nativeTheme';
import type { FontMetrics } from './text/fontMetrics';

/**
 * Measures a run of text at a given font size. `null` where no text engine is
 * wired, so any minimum-size/layout function that needs text metrics must treat
 * an absent measurer as "no text contributes to this measurement" rather than
 * throw.
 */
/**
 * `lineSpacingPx` is the caller's OWN theme constant, and defaults to 0 —
 * Godot's `font->get_height()`, which is what most widgets floor against.
 * Only a widget whose theme sets `line_spacing` (Label's 3) passes one, and it
 * applies BETWEEN lines only: the returned height never carries a trailing gap
 * below the last line, so a single-line measurement is exactly the font height
 * whatever the spacing.
 *
 * `fontMetrics` is the SAME `FontMetrics` (`./text/fontMetrics.ts`) the
 * caller's own painter shapes/paints against
 * (`text/resolveNodeFontMetrics.ts`'s `resolveNodeFontMetrics`) — defaults to
 * `measurer.ts`'s own `OPEN_SANS_FONT_METRICS` default when omitted, matching
 * every caller's behaviour before this parameter existed. Threading it
 * through is what keeps a floored minimum size in the SAME font the paint
 * pass draws: without it, a widget whose text engine resolves a scene font
 * would still floor its box against Open Sans's advances while painting the
 * scene font's — a box sized for the wrong text, never a crash (see
 * `measurer.ts`'s own doc).
 */
export type TextMeasurer = (
  text: string,
  fontSize: number,
  lineSpacingPx?: number,
  fontMetrics?: FontMetrics
) => Vec2;

export interface SolveContext {
  /** The scaled default theme, plain data. */
  theme: NativeTheme;
  /** `null` until the text engine (P11) lands. */
  measureText: TextMeasurer | null;
  /**
   * `Control::get_combined_minimum_size` for ANY node: the registered type's
   * `MinimumSizeFn` (or `(0, 0)` if unregistered) floored up to
   * `custom_minimum_size`. Exposed here (rather than only called internally by
   * `solveControlTree`) so a registered container's own `MinimumSizeFn` can
   * recurse into its children's combined minimum size through the SAME
   * function `solveControlTree` uses for its own floor step — one
   * implementation, not two that could drift apart.
   */
  combinedMinimumSize(n: SolveNode): Vec2;
  /**
   * The type-specific metadata a registered `MinimumSizeFn` attached
   * alongside its minimum size (`MinimumSizeResult.meta`), or `undefined` if
   * it returned a bare `Vec2` or attached none. Reads the SAME memoised
   * computation `combinedMinimumSize` already ran for `n` — calling this
   * costs nothing beyond a cache lookup once `combinedMinimumSize(n)` (or
   * this) has run once for `n`'s path.
   *
   * Optional on the interface (unlike `combinedMinimumSize`) so the dozen
   * hand-rolled `SolveContext` literals every `nativeSolver.test.ts` builds
   * to unit-test a single `MinimumSizeFn` in isolation keep type-checking —
   * only `controlRectSolver.ts`'s own `record`/`dispatchChildren` (which
   * always run through `createSolveContext`, never a hand-rolled literal)
   * call this.
   */
  minimumSizeMeta?(n: SolveNode): unknown;
  /**
   * The FINAL resolved rect a PRIOR solve pass gave `n`, or `undefined`
   * before any pass has run (or when the current solve never needed a second
   * pass — see `controlRectSolver.ts`'s `solveControlTree`). The one
   * intentional escape hatch from `MinimumSizeFn`'s bottom-up-only contract:
   * a self-referential minimum size (`TextureRect`'s `EXPAND_FIT_WIDTH`/
   * `FIT_HEIGHT`, which Godot itself ties to the control's OWN current
   * `get_size()` — `texture_rect.cpp:107-133`) has no non-circular rect to
   * read on a tree's first pass, so `solveControlTree` runs a bounded SECOND
   * pass — fed by the FIRST pass's own resolved rects — only when the tree
   * contains a type that opted in
   * (`controlSolverRegistry.registerSizeDependentMinimum`). Every other
   * `MinimumSizeFn` ignores this and is unaffected: its inputs (props + the
   * rest of `ctx`) are identical between passes, so its output is too.
   */
  tentativeRect?(n: SolveNode): Rect2 | undefined;
}

/** A `MinimumSizeFn`'s result when it also needs to hand its OWN painter a computed intermediate (e.g. a shaped text layout) — see `MinimumSizeFn`'s own doc. */
export interface MinimumSizeResult {
  /** This type's own minimum-size contribution — `MinimumSizeFn`'s old, bare-`Vec2` return. */
  size: Vec2;
  /**
   * An intermediate this computation produced that the SAME node's native
   * painter would otherwise have to recompute from a narrower subset of the
   * inputs (risking divergence from the solver's own answer) — a shaped
   * `TextLayoutResult` (Button/Label) is the motivating case. Surfaces on
   * `SolvedControl.meta` / `NativeControlComponentProps.meta`, `unknown` at
   * the contract boundary since its shape is entirely this TYPE's own — the
   * painter that reads it back is the same slice that produced it, and casts
   * it the same way a painter already casts `solveNode.node.properties`.
   */
  meta?: unknown;
}

/**
 * `Control::get_minimum_size` for a registered type — the type's OWN
 * contribution, before the `custom_minimum_size` floor. May return a bare
 * `Vec2` (the common case) or a `MinimumSizeResult` when this node's own
 * painter needs an intermediate this computation already produced (see
 * `MinimumSizeResult`'s own doc) — `controlRectSolver.ts` normalises either
 * shape, so an existing implementation returning a bare `Vec2` needs no
 * change to keep working.
 */
export type MinimumSizeFn = (n: SolveNode, ctx: SolveContext) => Vec2 | MinimumSizeResult;

/** A `ContainerLayoutFn`'s result when it also needs to hand its OWN painter a computed intermediate — see `ContainerLayoutFn`'s own doc. */
export interface ContainerLayoutResult {
  /** Every child's rect — `ContainerLayoutFn`'s old, bare-`Map`-only return. */
  rects: ReadonlyMap<string, Rect2>;
  /**
   * An intermediate THIS container's layout produced that its OWN painter
   * would otherwise have to recompute from a narrower subset of the inputs
   * (e.g. a split's `computed_split_offset`, a scroll container's full
   * scrollbar geometry) — see `MinimumSizeResult.meta`'s own doc for why this
   * is `unknown` at the contract boundary and how a painter reads it back.
   */
  meta?: unknown;
}

/**
 * `Container::fit_child_in_rect` for a registered container type: given the
 * container's content rect (its own rect minus chrome, e.g. Panel margins)
 * and each child's combined minimum size, returns every child's rect —
 * relative to the CONTAINER's top-left, not the content rect's, since a
 * container with chrome must add its own inset back in.
 *
 * May return a bare `ReadonlyMap<string, Rect2>` (the common case) or a
 * `ContainerLayoutResult` when this container's own painter needs an
 * intermediate the layout already computed (see `ContainerLayoutResult`'s
 * own doc) — `controlRectSolver.ts` normalises either shape, so an existing
 * implementation returning a bare `Map` needs no change to keep working.
 */
export type ContainerLayoutFn = (
  n: SolveNode,
  children: readonly { node: SolveNode; minSize: Vec2 }[],
  contentRect: Rect2,
  ctx: SolveContext
) => ReadonlyMap<string, Rect2> | ContainerLayoutResult;

/**
 * One Texture2D-valued property a node's own type wants sized —
 * `buildSolveTree.ts` resolves `ref` the SAME way for every request (inline,
 * `.tres` AtlasTexture, or a loaded file), so a type opting into more than
 * one slot can never see a different answer for the same ref than a type
 * with only one.
 */
export interface TextureSlotRequest {
  /**
   * The key this request's resolved size answers under, in
   * `SolveNode.textureSlots` — the registering slice's own choice: a Godot
   * property name for a fixed slot (`TextureProgressBar`'s
   * `texture_under`/`texture_progress`/`texture_over`), or the raw ref
   * string itself for a request synthesized from parsed content
   * (`RichTextLabel`'s embedded `[img]`s, one request per distinct ref).
   */
  key: string;
  /** The raw Texture2D-valued property text — an `ExtResource(...)`/`SubResource(...)`/`res://` ref. */
  ref: string;
  /**
   * The resource scope `ref` addresses — omitted (defaulting to the
   * requesting NODE's own scope) by every slice whose refs are all its own
   * properties. A themed icon needs this set explicitly: a `<Type>/icons/
   * <name>` ref from an ancestor/project Theme addresses THAT theme file's
   * own sub-resource pool, never the node's (`ThemedIconRef`'s own doc).
   */
  scope?: SolveNode['resources'];
}

/**
 * Which Texture2D-valued slots a node's own type carries, given the LIVE
 * (collapsed) node and its resolved theme icons (`SolveNode.icons` — built
 * BEFORE this runs, since it needs the theme walk) — a fixed list for most
 * registering types, or content-derived (`RichTextLabel`'s `[img]` refs).
 * "Which properties are Texture2D-valued" is a per-type fact, so this lives
 * on the type's own slice, not as a central list `buildSolveTree.ts` would
 * otherwise have to keep in sync with every Control type it walks.
 *
 * `themedIcons` is unused by every registrant that carries no themeable icon
 * (`TextureProgressBar`'s three layers, `TextureButton`'s draw states,
 * `RichTextLabel`'s embedded images are all plain `texture`-typed
 * PROPERTIES, never theme items) — optional, rather than forcing every
 * existing registrant (and its unit tests, which call the exported
 * `TextureSlotsFn` directly with one argument) to accept and drop a second
 * one. `buildSolveTree.ts`'s own call site always passes it.
 *
 * A type that never registers one keeps `buildSolveTree.ts`'s generic
 * single-slot fallback (`texture` or `icon`, whichever it carries) — the
 * SAME resolution, just against one implicit request instead of a
 * registered list.
 */
export type TextureSlotsFn = (
  node: TscnNode,
  themedIcons?: Readonly<Record<string, ThemedIconRef>>
) => readonly TextureSlotRequest[];

class ControlSolverRegistry {
  private readonly minimumSizeFns = createTypeRegistry<MinimumSizeFn>('controlSolverRegistry.minimumSize');
  private readonly containerLayoutFns = createTypeRegistry<ContainerLayoutFn>(
    'controlSolverRegistry.containerLayout'
  );
  private readonly textureSlotFns = createTypeRegistry<TextureSlotsFn>('controlSolverRegistry.textureSlots');
  private readonly canvasBoundaryTypes = new Set<string>();
  private readonly sizeDependentMinimumTypes = new Set<string>();

  /**
   * Declares a type that lives in the Control walk but is NOT a `CanvasItem` —
   * `CanvasLayer` is the one such type today. It authors no anchors/offsets, so
   * the anchor formula would give it a degenerate `(0, 0)` rect, and every real
   * Control under it would then anchor against THAT instead of the rect Godot
   * uses (`Control::get_parent_anchorable_rect` falls back to the viewport when
   * the parent is not a CanvasItem). Data on the registry rather than a type
   * comparison inside the solver, matching how every other per-type behaviour
   * reaches it.
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
   * Declares a type whose `MinimumSizeFn` reads `SolveContext.tentativeRect`
   * (see that field's own doc) — `TextureRect` is the one type that does
   * today. `solveControlTree` checks this SET, not the type's registered
   * function itself, to decide whether a tree needs a second solve pass at
   * all: the overwhelming majority of trees carry no such type, and this
   * keeps that check a plain membership test during the walk it already
   * performs (`assignPaintIndex`), not a second traversal of its own.
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

  /** This type's own `TextureSlotsFn`, or `undefined` for a type that keeps the generic single-slot fallback (see `TextureSlotsFn`'s own doc). */
  textureSlots(typeName: string): TextureSlotsFn | undefined {
    return this.textureSlotFns.get(typeName);
  }

  minimumSize(typeName: string): MinimumSizeFn | undefined {
    return this.minimumSizeFns.get(typeName);
  }

  containerLayout(typeName: string): ContainerLayoutFn | undefined {
    return this.containerLayoutFns.get(typeName);
  }

  /** Test-only: drop every registration (HMR/registry hygiene between test files). */
  clear(): void {
    this.minimumSizeFns.clear();
    this.containerLayoutFns.clear();
    this.textureSlotFns.clear();
    this.canvasBoundaryTypes.clear();
    this.sizeDependentMinimumTypes.clear();
  }
}

export const controlSolverRegistry = new ControlSolverRegistry();
