/**
 * The Control rect solver's per-type registry (ADR-0002's `typeName → value`
 * pattern, reused via `createTypeRegistry` exactly like
 * `ControlComponentRegistry.ts`). A type with no registration is a leaf: its
 * minimum size is `(0, 0)` and it imposes no layout on its children (they
 * solve as free/anchored Controls against its own rect). Per-type
 * registration is later packets' work (P6a onward) — this packet registers
 * none.
 *
 * Pure data + functions, no React, no THREE.
 */

import { createTypeRegistry } from '../../../core/createTypeRegistry';
import type { Rect2, Vec2 } from './rect';
import type { SolveNode } from './solveTree';
import type { NativeTheme } from './nativeTheme';

/**
 * Measures a run of text at a given font size. `null` until the text engine
 * (packet P11) lands, so any minimum-size/layout function that needs text
 * metrics before then must treat an absent measurer as "no text contributes
 * to this measurement" rather than throw.
 */
export type TextMeasurer = (text: string, fontSize: number) => Vec2;

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
}

/** `Control::get_minimum_size` for a registered type — the type's OWN contribution, before the `custom_minimum_size` floor. */
export type MinimumSizeFn = (n: SolveNode, ctx: SolveContext) => Vec2;

/**
 * `Container::fit_child_in_rect` for a registered container type: given the
 * container's content rect (its own rect minus chrome, e.g. Panel margins)
 * and each child's combined minimum size, returns every child's rect —
 * relative to the CONTAINER's top-left, not the content rect's, since a
 * container with chrome must add its own inset back in.
 */
export type ContainerLayoutFn = (
  n: SolveNode,
  children: readonly { node: SolveNode; minSize: Vec2 }[],
  contentRect: Rect2,
  ctx: SolveContext
) => ReadonlyMap<string, Rect2>;

class ControlSolverRegistry {
  private readonly minimumSizeFns = createTypeRegistry<MinimumSizeFn>('controlSolverRegistry.minimumSize');
  private readonly containerLayoutFns = createTypeRegistry<ContainerLayoutFn>(
    'controlSolverRegistry.containerLayout'
  );
  private readonly canvasBoundaryTypes = new Set<string>();

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

  registerContainerLayout(typeName: string, fn: ContainerLayoutFn): void {
    this.containerLayoutFns.register(typeName, fn);
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
    this.canvasBoundaryTypes.clear();
  }
}

export const controlSolverRegistry = new ControlSolverRegistry();
