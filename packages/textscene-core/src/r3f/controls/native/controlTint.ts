/**
 * Adapts a Control's `modulate`/`self_modulate` (`ControlColor`, the parsed
 * 0..1 channel shape `ControlProperties` carries) onto the existing 2D
 * CanvasItem tint chain: `multiplyModulate` + `useGodotLinearColor`, the same
 * arithmetic `useCanvasItemTint` runs for Sprite2D/TileMap/every other
 * CanvasItem, so a Control composes with an ancestor's `Modulate2DContext`
 * value exactly like any other 2D node. Per that module's own rule, colors
 * compose in sRGB (the space Godot's `Color(...)` literals are written in) and
 * convert to the renderer's linear working space exactly ONCE, at the end of
 * the chain — this module does not re-derive that curve, only feeds it.
 *
 * BOTH hooks are `ControlCanvasWalker`'s, and the split is the whole point:
 * `useInheritedModulate` folds `modulate` (hierarchical, published as the
 * ambient every descendant reads), `useControlOwnTint` folds `self_modulate`
 * onto that result (own pixels only, handed to the painter as
 * `NativeControlComponentProps.tint`). A painter resolves neither, the way
 * `CanvasItem2D` already resolves the Node2D family's tint for its `body`.
 */
import { useMemo } from 'react';
import type * as THREE from 'three';
import type { ControlColor } from '../../../nodes/2d/ui/control/types';
import { useParentModulate, WHITE_MODULATE, multiplyModulate, type RGBA } from '../../canvasItemModulate';
import { useGodotLinearColor } from '../../godotColor';
import { controlProps, type SolveNode } from './solveTree';

/** `ControlColor` is structurally an `RGBA`, so an absent one is the only case. */
function toRGBA(c: ControlColor | undefined): RGBA {
  return c ?? WHITE_MODULATE;
}

/**
 * The value a Control's DESCENDANTS inherit: ancestor tint × this node's
 * `modulate`. Walker-only — a painter renders inside the provider this feeds,
 * so it must never call this. Absent `modulate` means "no tint", matching
 * Godot's own opaque-white default.
 *
 * Godot's own chain, for why this same value is what the node's OWN pixels
 * start from: `_cull_canvas_item` folds `ci->modulate` into the inherited
 * colour and only then draws the item at that × `ci->self_modulate`
 * (`servers/rendering/renderer_canvas_cull.cpp`).
 */
export function useInheritedModulate(modulate: ControlColor | undefined): RGBA {
  const parent = useParentModulate();
  const own = toRGBA(modulate);
  return useMemo(() => multiplyModulate(parent, own), [parent, own]);
}

/**
 * What a painter gets — `CanvasItemTint` minus `inherited`, spelled out rather
 * than `Omit`-ed so a later field on that type cannot leak into every painter.
 */
export interface ControlOwnTint {
  /** The own-pixel product, still raw sRGB — for a widget composing further base colours. */
  own: RGBA;
  /** Linear-space own-pixel tint. */
  color: THREE.Color;
  /** Own-pixel opacity. */
  opacity: number;
}

/**
 * A Control's OWN-pixel tint: `inherited` (this node's `useInheritedModulate`
 * result, so it already carries its `modulate`) × its `self_modulate`.
 *
 * Takes `inherited` as an argument rather than reading the context: the walker
 * computes this BESIDE the fold, above the provider it publishes, where a
 * context read would answer with the parent's value and drop this node's own
 * `modulate` from its own chrome.
 *
 * A widget composing further base colours of its own multiplies them into
 * `tint.own` while both are still sRGB (a StyleBox's fill and border, a per-run
 * bbcode colour, a Label's font colour), so the conversion below stays the only
 * one.
 */
export function useControlOwnTint(inherited: RGBA, solveNode: SolveNode): ControlOwnTint {
  const selfModulate = toRGBA(controlProps(solveNode).selfModulate);
  const own = useMemo(() => multiplyModulate(inherited, selfModulate), [inherited, selfModulate]);
  const color = useGodotLinearColor(own);
  // Memoized as a whole: it is a PROP now, and painters memoize on it.
  return useMemo(() => ({ own, color, opacity: own.a }), [own, color]);
}
