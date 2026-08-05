/**
 * Maps Godot Control `type` strings to their native (WebGL canvas) painter —
 * the 2D-UI analogue of NodeComponentRegistry (ADR-0002). Kept separate so the
 * 3D registry stays THREE-typed; both share `createTypeRegistry`.
 */

import type React from 'react';
import type { ReactNode } from 'react';
import { createTypeRegistry } from '../../core/createTypeRegistry';
import type { NativeTheme } from './native/nativeTheme';
import type { TextMeasurer } from './native/solverRegistry';
import type { Rect2 } from './native/rect';
import type { SolveNode } from './native/solveTree';

/**
 * Props a Control painter receives from `ControlCanvasWalker`. A painter
 * draws only its OWN chrome: `ControlCanvasWalker` positions this node's
 * outer `<group>` and renders its (already-solved, self-positioning)
 * children as siblings, so no child content is threaded through the
 * painter's props. `rect` is in LOCAL space — (0, 0) at this node's own
 * top-left; the walker's outer group already carries its viewport/
 * parent-relative position.
 */
export interface NativeControlComponentProps {
  /** This Control's solved node — collapsed live node, its own styleBoxes/textureSize. */
  solveNode: SolveNode;
  /** This Control's solved rect, LOCAL space (position already applied by the walker). */
  rect: Rect2;
  /**
   * The default theme at the active project's `gui/theme/default_theme_scale`.
   *
   * Supplied rather than resolved per painter: the walker already holds it (the
   * solve needs it too), so five painters were each re-reading project settings
   * and re-deriving the same object. Handing it down also means a painter and
   * the solver that sized it can never see different theme metrics.
   */
  theme: NativeTheme;
  /**
   * Text measurement, or `null` before the metrics are available. The same
   * measurer the solve used, so a painter's own layout of a string agrees with
   * the minimum size that string produced.
   */
  measureText: TextMeasurer | null;
  /**
   * The SOLVED rects of this Control's direct children, keyed by node path.
   *
   * Chrome whose position depends on where the children ended up — a split
   * container's grabber, a scroll container's bars — otherwise has to recompute
   * layout the solver already did, from whatever subset of the inputs a painter
   * can reach. That recomputation can disagree with the solver, which is a
   * silent divergence rather than a visible bug.
   */
  childRects: ReadonlyMap<string, Rect2>;
  /**
   * This Control's draw-order key — `bandBase(canvasLayer) + paintIndex`
   * (`native/controlDrawOrder.ts`) — for the painter's own mesh(es). Every 2D
   * material in this codebase is transparent + depthWrite=false, so three's
   * transparent sort decides paint order from this value, never from z.
   */
  renderOrder: number;
  /**
   * A SECOND draw-order key for chrome that must draw AFTER this node's
   * ENTIRE subtree, regardless of `renderOrder` (this node's OWN paint
   * slot — every descendant necessarily exceeds it, since `paintIndex` is a
   * single pre-order counter across the whole tree). Godot's own answer to
   * "draw after my children" is `INTERNAL_MODE_BACK`: `Node::add_child(...,
   * INTERNAL_MODE_BACK)` places a child AFTER every normal child regardless
   * of when it was added, and `ScrollContainer` is exactly such a case —
   * its `h_scroll`/`v_scroll` are added that way
   * (`scene/gui/scroll_container.cpp:919,924`) so its scrollbars paint over
   * the scrolled content rather than under it. `LineEdit`, `OptionButton`,
   * `RichTextLabel`, and `SplitContainer` all use internal children for the
   * same reason (their own source files), so this is a general capability
   * on the contract, not a `ScrollContainer` special case.
   *
   * `bandBase(canvasLayer) + subtreeLastPaintIndex`
   * (`native/controlDrawOrder.ts`'s `controlRenderOrder`, fed
   * `SolvedControl.subtreeLastPaintIndex` — `native/controlRectSolver.ts`'s
   * `assignPaintIndex`). That value equals the LAST descendant's own
   * `renderOrder` (or this node's own, if it is a leaf), and the solver
   * hands the next sibling EXACTLY one past it — so a painter using this
   * value must offset by a FRACTION strictly inside that one-wide gap (e.g.
   * `+0.25`/`+0.5` for two layers of chrome) to draw after every descendant
   * without ever reaching the next sibling's own paint slot.
   *
   * REQUIRED even though only `INTERNAL_MODE_BACK`-style painters read it.
   * Making it optional would let a painter fall back to `renderOrder` when it
   * is absent, and that fallback IS the defect this field exists to fix — a
   * bar drawn under its own content, silently, with no type error and no
   * failing test. `painterEnv` (`native/testing/painterProps.ts`) exists so
   * widening this contract stays one edit rather than a quiet pressure to
   * weaken it for test convenience.
   */
  subtreeChromeRenderOrder: number;
  /**
   * This Control's OWN `z_final` — its `z_index` already accumulated onto its
   * ancestors' and clamped (`lighting2d/canvasItemPlacement.tsx`'s
   * `accumulateCanvasItemZ`). A 2D light's `range_z_min`/`range_z_max` window
   * is tested against this, and Godot tests an item against its own accumulated
   * value: `_cull_canvas_item` accumulates into `p_z` and only then calls
   * `_attach_canvas_item_for_draw(ci, …, p_z, …)`
   * (`servers/rendering/renderer_canvas_cull.cpp`).
   *
   * REQUIRED, and passed even though no painter reads it yet, because the way
   * to get this wrong is silent. `useCanvasItemLighting`'s `effectiveZ`
   * parameter is optional and falls back to `useEffectiveZ()` — and the
   * walker publishes that context to a node's DESCENDANTS, so the ambient a
   * painter would read is its PARENT's z, missing the painter's own
   * `z_index`. A painter that opts into lighting must therefore hand this
   * value in explicitly, exactly as `CanvasItem2D.tsx` does for the Node2D
   * path. Nothing about that mistake produces a type error or a failing test:
   * it is invisible in every scene without a `PointLight2D`, and wrong only
   * at the z-window edge in the scenes that have one.
   */
  effectiveZ: number;
  /**
   * This Control's own intermediate, if its registered `MinimumSizeFn`/
   * `ContainerLayoutFn` attached one (`native/controlRectSolver.ts`'s
   * `SolvedControl.meta` — see that field's own doc for which of the two
   * sources wins when a type registers both). `unknown` at this boundary:
   * its shape is entirely the producing slice's OWN, so a painter casts it
   * exactly like it already casts `solveNode.node.properties` — e.g.
   * `HSplitContainer`'s painter reading back its `ContainerLayoutFn`'s own
   * `computed_split_offset` instead of recomputing the split boundary from a
   * narrower subset of the inputs (`custom_minimum_size` alone, which
   * disagrees with the solver's full recursive `combined_minimum_size` the
   * moment either sortable child is itself a container or carries shaped
   * text) — the exact divergence hazard `childRects` above already exists to
   * close for solved RECTS; this closes the same hazard for whatever a
   * registered solver computed and would otherwise be forced to discard.
   *
   * REQUIRED even though most painters never read it, for the same reason
   * `subtreeChromeRenderOrder`/`effectiveZ` are: an optional field would let
   * a painter that DOES need it silently fall back to `undefined` and
   * re-derive its own (potentially wrong) approximation instead, with no
   * type error marking the gap. `painterEnv()` (`native/testing/
   * painterProps.ts`) exists so widening this contract stays one edit.
   */
  meta: unknown;
  /**
   * Rendered ONLY for a passthrough host that draws no chrome of its own but
   * must still wrap its descendants in fresh context — `CanvasLayer`'s native
   * painter (`nodes/2d/ui/canvaslayer/Component.tsx`) is the one type
   * that needs this. Every other registered painter draws fixed chrome and
   * receives `undefined` here: `ControlCanvasWalker` renders a Control's
   * children as SIBLINGS of its painter, not through this prop, except for
   * that one passthrough case.
   */
  children?: ReactNode;
}

export type NativeControlComponent = React.ComponentType<NativeControlComponentProps>;

export interface ControlComponentRegistration {
  typeName: string;
  /** The native (WebGL canvas) painter for this Control type. */
  Component: NativeControlComponent;
  /**
   * Whether this type's native painter receives its Control children as React
   * children instead of the walker rendering them as siblings.
   *
   * Data on the registration rather than a `node.type` comparison in the walker:
   * the walker is generic infrastructure, and `NodeComponentRegistry` already
   * establishes this pattern for exactly this kind of question (`canvasItem`,
   * `container`, `csgShape`). A second wrapping type would otherwise add a
   * second hardcoded branch, and the two could drift on which types wrap.
   *
   * Only a type that establishes a new ambient scope for its subtree needs it.
   * Two do: `CanvasLayer` publishes a draw-order band and a fresh modulate scope,
   * and `ScrollContainer` publishes clip planes — different scopes, same
   * structural requirement, which is why this is one flag rather than two.
   */
  wrapsChildren?: boolean;
}

class ControlComponentRegistryImpl {
  private readonly registry = createTypeRegistry<NativeControlComponent>('ControlComponentRegistry');
  private readonly childWrappingTypes = new Set<string>();

  register(registration: ControlComponentRegistration): void {
    this.registry.register(registration.typeName, registration.Component);
    if (registration.wrapsChildren) {
      this.childWrappingTypes.add(registration.typeName);
    }
  }

  /** The registered native (WebGL canvas) painter, or undefined until a slice ships one. */
  get(typeName: string): NativeControlComponent | undefined {
    return this.registry.get(typeName);
  }

  /** Whether this type's native painter takes its children rather than the walker placing them. */
  wrapsChildren(typeName: string): boolean {
    return this.childWrappingTypes.has(typeName);
  }

  has(typeName: string): boolean {
    return this.registry.has(typeName);
  }

  getAllTypeNames(): string[] {
    return this.registry.getAllTypeNames();
  }

  clear(): void {
    this.registry.clear();
    this.childWrappingTypes.clear();
  }
}

export const controlComponentRegistry = new ControlComponentRegistryImpl();
