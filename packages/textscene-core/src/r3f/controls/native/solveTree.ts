/**
 * `SolveNode` — the Control rect solver's input shape. Built by the
 * `liveSceneTree`-based walker (packet P3, `native/buildSolveTree.ts`); this
 * module only defines the type, so the solver (this packet) and the walker
 * (P3) can be developed against the same contract without either depending on
 * the other's implementation.
 *
 * Pure data, no React, no THREE.
 */

import type { TscnNode } from '../../../parser/types';
import type { ControlProperties } from '../../../nodes/2d/ui/control/types';
import type { FontResource } from '../../../resources/fonts/font/types';
import type { ThemeResource } from '../../../resources/styles/theme/types';
import type { Vec2 } from './rect';
import type { PaintRange } from '../../canvasPaintOrder';
import type { StyleBoxFlatData } from './styleBoxFlat';

// Re-exported for existing importers of the type from its former home —
// `native/styleBoxFlat.ts` is the single definition now.
export type { StyleBoxFlatData };

/**
 * One Control (or 2D-UI node) in the live, already-collapsed scene tree —
 * instance roots merged, sub-scene scope resolved — ready for the solver.
 */
export interface SolveNode {
  /** Dispatcher-absolute path, from the live scene tree. */
  path: string;
  /** The COLLAPSED live node (post instance-merge). */
  node: TscnNode;
  /** From `liveChildGroups`; each child's own scope is already resolved. */
  children: readonly SolveNode[];
  /**
   * The run of canvas draw-sequence values this node's subtree owns
   * (`canvasPaintOrder.ts`).
   *
   * Derived here from the node's position among ALL its live siblings, Controls
   * and Node2Ds alike — which this walk can see and the Control tree alone
   * cannot, since a Control promotes past a non-Control ancestor and loses its
   * place among that ancestor's children on the way. Without it a Control could
   * only be ordered against other Controls, and a background `ColorRect`
   * authored first would draw over the sprites that follow it.
   */
  paintRange: PaintRange;
  /**
   * The draw-sequence value this node draws its OWN pixels at — its position in
   * Godot's walk, after any `show_behind_parent` children and before the rest.
   */
  paintSequence: number;
  /** This node's `theme_override_styles/*` StyleBoxes, resolved in ITS scope. */
  styleBoxes: Readonly<Record<string, StyleBoxFlatData>>;
  /** `null` until the node's texture (if any) has loaded. */
  textureSize: Vec2 | null;
  /**
   * The scene-tree eye toggle for this path (`SelectionContext.hiddenNodePaths`).
   *
   * Carried on the node rather than consulted at paint time because it stands in
   * for clearing `visible` in the editor, and `visible` reaches the SOLVE:
   * `Container::_sort_children` skips a child `as_sortable_control` rejects, so
   * a hidden one leaves no slot. Hiding it only in the emitted group would keep
   * the slot and paint a permanent hole in every container above it.
   */
  hidden: boolean;
  /**
   * This node's OWN `theme_override_fonts/*`, resolved in ITS scope. Presence
   * of a key means it was AUTHORED (`Control::get_theme_font`'s local-override
   * branch has no validity check) — the value is `null` when the ref failed to
   * resolve. `buildSolveTree.ts` always sets this to `{}` at minimum, so every
   * producer of a `SolveNode` is total; required here (rather than defaulted
   * via `?? {}` at each read site) so a hand-built test literal that omits it
   * fails to compile instead of silently resolving no font — this repo has
   * been bitten twice by an optional input a test could leave out while
   * production never does. `testing/solveNode.ts`'s `solveNode()` factory
   * supplies the empty default for a literal that does not care.
   */
  fontOverrides: Readonly<Record<string, FontResource | null>>;
  /**
   * Nearest-first ancestor Controls' resolved `theme` — this node's own
   * `theme`, if it has one, is index 0 (`Control::get_theme_font`'s ancestor
   * walk, `scene/theme/theme_owner.cpp`'s `ThemeOwner::_get_next_owner_node`).
   * An ancestor Control with NO `theme` set contributes no entry. Feeds
   * `theme/lookup.ts`'s `resolveThemeFontIn`/`resolveThemeFontSizeIn`.
   * Required — see `fontOverrides`'s own doc for why.
   */
  themeChain: readonly ThemeResource[];
  /**
   * The project's default theme (`gui/theme/custom`), resolved; `null` when
   * unset/unresolved/failed. Required — see `fontOverrides`'s own doc for why.
   */
  projectTheme: ThemeResource | null;
}

/**
 * This node's properties as the Control base type.
 *
 * Lives beside `SolveNode` because every solver and painter needs it and the
 * cast is the same one every time — the parser produces the properties bag and
 * the slice knows which shape it authored. Duplicating the one-liner per slice
 * is how a second, subtly different cast eventually appears.
 */
export function controlProps(n: SolveNode): ControlProperties {
  return n.node.properties as ControlProperties;
}

/**
 * A Control's properties MINUS the two the walker has already consumed.
 *
 * Both fields genuinely exist on a Control — this is not a narrowing of the
 * node's data, only of what a PAINTER may see. `ControlCanvasWalker` folds
 * `modulate` into the ambient `Modulate2DContext` around the painter and
 * `self_modulate` into the `tint` it hands the painter, so a painter re-reading
 * either would double-apply it.
 */
export type PainterView<T> = Omit<T, 'modulate' | 'selfModulate'>;

/**
 * One view per property bag, so repeated calls return the SAME object —
 * painters memoize on props identity. Weak so a re-parse's discarded bags go
 * with it.
 */
const PAINTER_VIEWS = new WeakMap<object, object>();

/** This node's properties as its own type, in the painter view. */
export function painterView<T extends ControlProperties>(n: SolveNode): PainterView<T> {
  const bag = n.node.properties;
  const cached = PAINTER_VIEWS.get(bag);
  if (cached) return cached as PainterView<T>;
  // Rest-destructured, not assigned `undefined`: a helper handed the whole
  // object must not find the key at all. Shallow — nested values stay shared.
  const { modulate: _modulate, selfModulate: _selfModulate, ...view } = bag as ControlProperties;
  PAINTER_VIEWS.set(bag, view);
  return view as unknown as PainterView<T>;
}

/**
 * This node's raw property keys, in real file order — `undefined` when that
 * order is unknown or unreliable (a hand-built literal with no `rawProperties`
 * at all, or a merged instance root whose raw merge mixes two files' orders,
 * `resources/mergeInstanceRoot.ts`, ADR-0035).
 *
 * Consumed by every file-order-sensitive resolver
 * (`r3f/controls/controlAnchors.ts`'s `resolveControlLayout`,
 * `nodes/2d/ui/shared/range.ts`'s `resolveRangeValue`) so each computes its
 * own order fact from the SAME node-level source rather than re-deriving the
 * `rawPropertiesOrderReliable` check per call site.
 */
export function controlLayoutOrder(n: SolveNode): readonly string[] | undefined {
  const { node } = n;
  return node.rawPropertiesOrderReliable && node.rawProperties ? Object.keys(node.rawProperties) : undefined;
}
