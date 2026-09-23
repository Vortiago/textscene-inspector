/**
 * `SolveNode`, the Control rect solver's input shape, which `native/buildSolveTree.ts`
 * builds. The solver and the walker share this contract without depending on
 * each other. Pure data: no React, no THREE.
 */

import type { SceneScope, TscnNode } from '../../../parser/types';
import type { ControlColor, ControlProperties } from '../../../nodes/2d/ui/control/types';
import type { FontResource } from '../../../resources/fonts/font/types';
import type { ThemeResource } from '../../../resources/styles/theme/types';
import type { Vec2 } from './rect';
import type { PaintRange } from '../../canvasPaintOrder';
import type { StyleBoxFlatData } from './styleBoxFlat';

/**
 * One resolved, unloaded theme icon: the raw Texture2D-valued ref plus the scope
 * it addresses. A `theme_override_icons/<name>` resolves in the node's scope, and
 * a `<Type>/icons/<name>` from a Theme resolves in that theme file's scope.
 */
export interface ThemedIconRef {
  ref: string;
  resources: SceneScope;
}

/**
 * A 2D affine transform in Godot's `Transform2D` layout (`core/math/transform_2d.h`),
 * +Y down: `x' = a*x + c*y + tx`, `y' = b*x + d*y + ty`. Never decomposed, since
 * composed ancestors can shear, which rotation and scale cannot represent.
 */
export interface Affine2D {
  a: number;
  b: number;
  c: number;
  d: number;
  tx: number;
  ty: number;
}

/**
 * The accumulated `CanvasItem` state of the non-Control ancestors a promoted
 * Control was walked past: the facets `_render_canvas_item_tree` re-seeds for a
 * canvas root (`renderer_canvas_cull.cpp:70-83`), as one value because one break resets all.
 * Visibility follows the scene tree instead: {@link SolveNode.parentVisibleInTree}.
 */
// Two facets are missing, so a skipped ancestor that sets one diverges: the material owner (no
// native painter reads `CanvasItemMaterialContext`) and the texture sampler
// (`Node2DProperties` does not parse `texture_filter`/`texture_repeat`).
export interface SkippedAncestors {
  /** Composed `Transform2D`, outermost first (`transform_2d.cpp:198-217`). */
  transform: Affine2D;
  /** Componentwise product of each skipped ancestor's `modulate`; `self_modulate` never propagates (`renderer_canvas_cull.cpp`). */
  modulate: ControlColor;
  /**
   * Each skipped ancestor's `z_index`/`z_as_relative`, outermost first. A list,
   * not a sum: `p_z = CLAMP(p_z + ci->z_index, …)` clamps at every step and
   * `z_relative == false` restarts (`renderer_canvas_cull.cpp:430-434`). The walker folds it.
   */
  z: readonly CanvasItemZStep[];
}

/** One CanvasItem's contribution to `p_z` (`renderer_canvas_cull.cpp:430-434`). */
export interface CanvasItemZStep {
  zIndex: number;
  zAsRelative: boolean;
}

/**
 * One Control or 2D-UI node in the live, collapsed scene tree (instance roots
 * merged, sub-scene scope resolved), ready for the solver.
 */
export interface SolveNode {
  /** Dispatcher-absolute path, from the live scene tree. */
  path: string;
  /** The collapsed live node, after the instance merge. */
  node: TscnNode;
  /**
   * The Controls whose canvas item parents at this node's, each in its own scope.
   * A Control promoted past a Node2D appears here as a grandchild, and one whose
   * `CanvasItem` chain broke is hoisted to the canvas it parents to instead.
   */
  children: readonly SolveNode[];
  /**
   * The run of canvas draw-sequence values this node's subtree owns
   * (`canvasPaintOrder.ts`), from its place among all live siblings, Node2Ds
   * included, so a `ColorRect` authored first draws under the sprites after it.
   */
  paintRange: PaintRange;
  /**
   * The draw-sequence value of this node's own pixels: after any
   * `show_behind_parent` children and before the rest.
   */
  paintSequence: number;
  /**
   * What the non-Control `CanvasItem` ancestors this node promoted past contribute,
   * or `null` for none. Non-null tells the solver that `data.parent_canvas_item`
   * is not a Control (`isPromotedControl`).
   */
  // Transform, tint and z accumulate down `CanvasItem::get_parent_item()`, which
  // casts only the direct parent and returns nullptr for `top_level`
  // (`scene/main/canvas_item.cpp:565-571`). A plain `Node`, `Node3D` or `CanvasLayer`
  // breaks the chain: `null`, and the node is hoisted to a canvas root.
  skippedAncestors: SkippedAncestors | null;
  /**
   * `CanvasItem::parent_visible_in_tree`, the other half of `is_visible_in_tree()`
   * (`canvas_item.cpp:62-64`). It follows the scene tree with no `top_level` test
   * (`canvas_item.cpp:311-316`, `canvas_item.cpp:103-108`), so it reaches a hoisted Control.
   */
  // It resets twice: a `CanvasLayer` parent gives its own `is_visible()`
  // (`canvas_item.cpp:325-329`), and another non-CanvasItem parent gives the
  // `Window`'s visibility, or `true` in a `SubViewport` (`canvas_item.cpp:330-350`).
  // So a Control under a hidden Node3D still draws.
  parentVisibleInTree: boolean;
  /**
   * `Control::is_layout_rtl()` (`scene/gui/control.cpp:3551-3620`), resolved on the
   * walk because an inherited node climbs past non-Controls the solve tree lacks.
   * The rect solve (`control.cpp:1785-1787`), containers and painters read it.
   */
  rtl: boolean;
  /**
   * Resolved StyleBoxes by `get_theme_stylebox(name, type)` name: a
   * `theme_override_styles/*` wins unconditionally, else an ancestor or project
   * Theme in that theme file's scope (`theme/lookup.ts`'s `mergeThemedRecord`).
   * A painter falls back to the default theme's box on a miss.
   */
  styleBoxes: Readonly<Record<string, StyleBoxFlatData>>;
  /** `null` until the node's texture (if any) has loaded. */
  textureSize: Vec2 | null;
  /**
   * Every Texture2D-valued slot the type registers (`registerTextureSlots`), by
   * its key: `null` until loaded, empty for a type that registers none. Resolved
   * by the same `resolveTextureSize` as `textureSize`, so the two cannot disagree.
   */
  textureSlots: Readonly<Record<string, Vec2 | null>>;
  /**
   * The scene-tree eye toggle for this path (`SelectionContext.hiddenNodePaths`).
   * It stands in for clearing `visible`, which reaches the solve: a hidden child
   * leaves no container slot, where hiding only at paint time leaves a hole.
   */
  hidden: boolean;
  /**
   * This node's own `theme_override_fonts/*` in its scope. A key means authored
   * (`Control::get_theme_font` does not check validity), `null` when the ref failed.
   * Required, so a test literal that omits it fails to compile; production always
   * sets it, and `testing/solveNode.ts`'s `solveNode()` supplies `{}`.
   */
  fontOverrides: Readonly<Record<string, FontResource | null>>;
  /**
   * Resolved `theme`s of this node and its ancestor Controls, nearest first
   * (`scene/theme/theme_owner.cpp`'s `ThemeOwner::_get_next_owner_node`). A Control
   * without a `theme` adds no entry. Required, like `fontOverrides`.
   */
  themeChain: readonly ThemeResource[];
  /**
   * The project's default theme (`gui/theme/custom`), or `null` when unset or
   * unresolved. Required, like `fontOverrides`.
   */
  projectTheme: ThemeResource | null;
  /**
   * Resolved theme colours by `get_theme_color(name, type)` name, merged like
   * `styleBoxes` over `theme.colors`. A painter falls back to the default
   * theme's colour on a miss.
   */
  colors: Readonly<Record<string, ControlColor>>;
  /**
   * Resolved theme constants by `get_theme_constant(name, type)` name, merged like
   * `colors` over `theme.constants`. A scene Theme's constant is never scaled.
   * Only the built-in default a painter falls back to is.
   */
  constants: Readonly<Record<string, number>>;
  /**
   * Theme icons by `get_theme_icon(name, type)` name, merged like `styleBoxes`,
   * but left unloaded: a texture needs a live `useTexture2D` subscription
   * (`useIconTexture.ts`'s `useNodeIcon`) that only a component holds. A painter
   * falls back to its vendored icon (`native/themeIcons.ts`) on a miss.
   */
  icons: Readonly<Record<string, ThemedIconRef>>;
  /**
   * The resource pools this node's own references resolve against. A node from
   * an instanced sub-scene names that scene's ids, while `SceneResourcesProvider`
   * holds the top-level scene's. A painter resolves a texture here itself, since
   * it loads asynchronously. Required, like `fontOverrides`.
   */
  resources: SceneScope;
}

/**
 * Whether the walker promoted `n` past a non-Control `CanvasItem`. Such a node is
 * a grandchild, so it is not the Control's `data.parent_canvas_item`
 * (`canvas_item.cpp:565-571`), and a Container that casts the direct child never
 * sorts it (`container.cpp:143-155`, `box_container.cpp:58`).
 */
export function isPromotedControl(n: SolveNode): boolean {
  return n.skippedAncestors !== null;
}

/** A `SolveNode` minus the sortable child list: what a share's callback sees (`solveHandoff.ts`). */
export type ShareNode = Omit<SolveNode, 'children'>;

/**
 * `n` as a walk over `get_child(i)` sees it: `children` without promoted Controls.
 * The floor pass, the arrangement and the painter read the same list
 * (`container.cpp:143-155`, `box_container.cpp:58`, `tab_container.cpp:469-481`),
 * so a type that indexes children by position numbers them alike in each.
 */
// Returns `n` itself when nothing is promoted, so no caller sees a fresh object per call.
export function sortableView(n: SolveNode): SolveNode {
  if (!n.children.some(isPromotedControl)) return n;
  return { ...n, children: n.children.filter((child) => !isPromotedControl(child)) };
}

/**
 * This node's properties as the Control base type: the one cast every solver
 * and painter shares, so no slice writes a different one.
 */
export function controlProps(n: ShareNode): ControlProperties {
  return n.node.properties as ControlProperties;
}

/**
 * A Control's properties minus the two the walker has consumed: `modulate` goes
 * into the ambient `Modulate2DContext` and `self_modulate` into `tint`, so a
 * painter that read either would apply it twice.
 */
export type PainterView<T> = Omit<T, 'modulate' | 'selfModulate'>;

/**
 * One view per property bag, so repeated calls return the same object: painters
 * memoise on props identity. Weak, so a re-parse's discarded bags go with it.
 */
const PAINTER_VIEWS = new WeakMap<object, object>();

/** This node's properties as its own type, in the painter view. */
export function painterView<T extends ControlProperties>(n: SolveNode): PainterView<T> {
  const bag = n.node.properties;
  const cached = PAINTER_VIEWS.get(bag);
  if (cached) return cached as PainterView<T>;
  // Rest-destructured, not assigned `undefined`: a helper handed the whole
  // object must not find the key at all. Shallow: nested values stay shared.
  const { modulate: _modulate, selfModulate: _selfModulate, ...view } = bag as ControlProperties;
  PAINTER_VIEWS.set(bag, view);
  return view as unknown as PainterView<T>;
}

/**
 * This node's raw property keys in file order, or `undefined` when the order is
 * unknown: no `rawProperties`, or a merged instance root mixing two files
 * (`resources/mergeInstanceRoot.ts`, ADR-0035). Every file-order-sensitive
 * resolver reads this rather than checking `rawPropertiesOrderReliable` itself.
 */
export function controlLayoutOrder(n: SolveNode): readonly string[] | undefined {
  const { node } = n;
  return node.rawPropertiesOrderReliable && node.rawProperties ? Object.keys(node.rawProperties) : undefined;
}
