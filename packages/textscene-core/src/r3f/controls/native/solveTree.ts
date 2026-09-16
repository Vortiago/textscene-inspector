/**
 * `SolveNode` — the Control rect solver's input shape. Built by the
 * `liveSceneTree`-based walker (`native/buildSolveTree.ts`); this module only
 * defines the type, so the solver and the walker share one contract without
 * either depending on the other's implementation.
 *
 * Pure data, no React, no THREE.
 */

import type { SceneScope, TscnNode } from '../../../parser/types';
import type { ControlColor, ControlProperties } from '../../../nodes/2d/ui/control/types';
import type { FontResource } from '../../../resources/fonts/font/types';
import type { ThemeResource } from '../../../resources/styles/theme/types';
import type { Vec2 } from './rect';
import type { PaintRange } from '../../canvasPaintOrder';
import type { StyleBoxFlatData } from './styleBoxFlat';

// Re-exported for existing importers of the type from its former home —
// `native/styleBoxFlat.ts` is the single definition now.
export type { StyleBoxFlatData };

/**
 * One resolved-but-unloaded theme icon reference: the raw Texture2D-valued
 * ref string, plus the resource SCOPE it addresses — a node's own
 * `theme_override_icons/<name>` resolves in the node's own scope, while a
 * `<Type>/icons/<name>` from an ancestor/project Theme resolves in THAT
 * theme file's own scope (a Theme's sub-resources belong to its file, the
 * same rule `styleBoxes`'s own resolution already follows). Left unloaded —
 * see `SolveNode.icons`'s own doc for why.
 */
export interface ThemedIconRef {
  ref: string;
  resources: SceneScope;
}

/**
 * A general 2D affine transform, Godot's own `Transform2D` layout: two basis
 * columns plus an origin (`core/math/transform_2d.h`), +Y down, unconjugated
 * — `x' = a*x + c*y + tx`, `y' = b*x + d*y + ty`. Never decomposed back into
 * rotation/scale/skew: composing several ancestors' transforms can shear even
 * when none of them individually did, and that shear has no rotation+scale
 * representation to decompose into.
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
 * One Control (or 2D-UI node) in the live, already-collapsed scene tree —
 * instance roots merged, sub-scene scope resolved — ready for the solver.
 */
/**
 * The accumulated `CanvasItem` state of the non-Control ancestors a promoted
 * Control was walked past, as one value because one break resets all of it.
 */
export interface SkippedAncestors {
  /** Composed `Transform2D`, outermost first (`transform_2d.cpp:198-217`). */
  transform: Affine2D;
  /** `is_visible_in_tree()` for the chain: every skipped ancestor's own `visible`, ANDed (`canvas_item.cpp:62-64`). */
  visible: boolean;
  /** Componentwise product of each skipped ancestor's `modulate`; `self_modulate` never propagates (`renderer_canvas_cull.cpp`). */
  modulate: ControlColor;
}

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
  /**
   * What every non-Control `CanvasItem` ancestor this node promoted past
   * (`buildSolveTree.ts`'s module doc) contributes to it — `null` when there
   * is none, the common case.
   *
   * The three facets travel together because ONE engine fact decides all
   * three at once: `CanvasItem::get_parent_item()` casts only the DIRECT
   * parent (`scene/main/canvas_item.cpp:565-571`), and `parent_visible_in_tree`
   * is read from that same direct parent (`canvas_item.cpp:313-350`). A
   * non-`CanvasItem` link (a plain `Node`, a `Node3D`, a `CanvasLayer`) BREAKS
   * the chain rather than being skipped over, so `null` past one of those too,
   * never the identity of everything below it.
   */
  skippedAncestors: SkippedAncestors | null;
  /**
   * This node's resolved StyleBoxes, keyed by the SAME names Godot's own
   * `get_theme_stylebox(name, type)` uses (`normal`/`hover`/`panel`/…):
   * `theme_override_styles/*` first (wins unconditionally once declared,
   * `Control::get_theme_stylebox`'s local-override branch), else every name
   * ANY applicable ancestor/project Theme resolves for this node's type chain
   * (`theme/lookup.ts`'s `mergeThemedRecord`, resolved in ITS scope — a
   * Theme's own StyleBoxes are sub-resources of THAT theme file, never this
   * node's). A name absent here has no themed answer at all; every painter
   * already falls back to the default theme's own box on a miss.
   */
  styleBoxes: Readonly<Record<string, StyleBoxFlatData>>;
  /** `null` until the node's texture (if any) has loaded. */
  textureSize: Vec2 | null;
  /**
   * Every Texture2D-valued slot THIS node's own type declares
   * (`controlSolverRegistry.registerTextureSlots`), keyed by that
   * registration's own key — `null` per key until that slot's texture has
   * loaded, and empty for a type that registers none. Resolved through the
   * SAME per-ref function `textureSize` is (`buildSolveTree.ts`'s
   * `resolveTextureSize`): one mechanism, not two that could disagree — a
   * type opting into more than one slot (`TextureProgressBar`'s three
   * layers, `TextureButton`'s draw-state textures, `RichTextLabel`'s
   * embedded `[img]`s) reads this instead of `textureSize`.
   */
  textureSlots: Readonly<Record<string, Vec2 | null>>;
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
  /**
   * This node's resolved theme colours, keyed by the same names Godot's
   * `get_theme_color(name, type)` uses (`font_color`/`font_hover_color`/…):
   * `theme_override_colors/*` first (unconditional local override), else the
   * theme chain — same merge `styleBoxes` uses, `theme/lookup.ts`'s
   * `mergeThemedRecord` over `theme.colors`. A name absent here has no themed
   * answer; a painter falls back to the default theme's own colour.
   */
  colors: Readonly<Record<string, ControlColor>>;
  /**
   * This node's resolved theme constants, keyed by the same names Godot's
   * `get_theme_constant(name, type)` uses (`h_separation`/`outline_size`/…) —
   * same merge as `colors`, over `theme.constants`. A scene Theme's constant
   * is a literal int and is NEVER scaled; only this previewer's OWN built-in
   * default (a painter's fallback on a miss here) is.
   */
  constants: Readonly<Record<string, number>>;
  /**
   * This node's resolved theme icons, keyed the same way Godot's own
   * `get_theme_icon(name, type)` keys them (`checked`/`grabber`/`close`/…):
   * `theme_override_icons/*` first (unconditional local override, resolved
   * in THIS node's own scope), else every name ANY applicable ancestor/
   * project Theme resolves for this node's type chain (`theme/lookup.ts`'s
   * `mergeThemedRecord`, resolved in ITS OWN theme file's scope — same merge
   * `styleBoxes` uses). Unlike `styleBoxes`, the reference is left
   * UNRESOLVED (`ThemedIconRef`, ref + the scope it addresses) rather than
   * eagerly decoded: loading a texture needs a live `useTexture2D`
   * subscription (`useIconTexture.ts`'s `useNodeIcon`), which only a
   * component can hold. A name absent here has no themed answer at all;
   * every painter falls back to its own vendored default-theme icon
   * (`native/themeIcons.ts`) on a miss, exactly like every other theme item.
   */
  icons: Readonly<Record<string, ThemedIconRef>>;
  /**
   * The resource pools this node's OWN property references resolve against.
   *
   * A node that arrived through an instanced sub-scene names ids from THAT
   * scene, while the ambient `SceneResourcesProvider` carries the top-level
   * scene's — so a painter reading the context resolves against the wrong pool
   * and silently draws nothing. `styleBoxes` and `fontOverrides` above are
   * already resolved in this scope for the same reason; this is the scope
   * itself, for the references a painter must resolve for itself (a texture
   * has to stay a live `useTexture2D` subscription, not a pre-resolved value,
   * because it loads asynchronously).
   *
   * Required — see `fontOverrides`'s own doc for why.
   */
  resources: SceneScope;
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
