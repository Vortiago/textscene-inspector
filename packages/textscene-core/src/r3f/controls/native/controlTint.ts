/**
 * Feeds a Control's `modulate` and `self_modulate` into the 2D CanvasItem tint chain
 * (`multiplyModulate`, then `useGodotLinearColor`), composing in sRGB with an ancestor's
 * `Modulate2DContext` like any other 2D node, and converting to linear once, at the end. Only
 * `ControlCanvasWalker` calls the hooks: one feeds descendants, one this node's pixels.
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
 * The value a Control's descendants inherit: ancestor tint × this node's
 * `modulate`. A painter renders inside the provider this feeds, so it never
 * calls this. An absent `modulate` is Godot's opaque-white default.
 */
// The node's own pixels start from this value too: `_cull_canvas_item` folds
// `ci->modulate` into the inherited colour, then draws at that × `ci->self_modulate`
// (`servers/rendering/renderer_canvas_cull.cpp`).
export function useInheritedModulate(
  modulate: ControlColor | undefined,
  skippedAncestors: ControlColor | undefined
): RGBA {
  const parent = useParentModulate();
  const own = toRGBA(modulate);
  // The skipped Node2D ancestors sit between the context value and this node,
  // so they fold in that order (`SolveNode.skippedAncestors`).
  const skipped = toRGBA(skippedAncestors);
  return useMemo(
    () => multiplyModulate(multiplyModulate(parent, skipped), own),
    [parent, skipped, own]
  );
}

/**
 * What a painter gets: `CanvasItemTint` minus `inherited`, spelled out rather
 * than `Omit`-ed so a later field on that type cannot leak into every painter.
 */
export interface ControlOwnTint {
  /** The own-pixel product, still sRGB, for a widget composing further base colours. */
  own: RGBA;
  /** Linear space. */
  color: THREE.Color;
  opacity: number;
}

/**
 * A Control's own-pixel tint: `inherited` (this node's `useInheritedModulate`
 * result) × its `self_modulate`. A widget multiplies its own base colours into
 * `tint.own` while both are sRGB, so the conversion below stays the only one.
 */
// An argument, not a context read: the walker runs this above the provider it
// publishes, where the context holds the parent's value without this `modulate`.
export function useControlOwnTint(inherited: RGBA, solveNode: SolveNode): ControlOwnTint {
  const selfModulate = toRGBA(controlProps(solveNode).selfModulate);
  const own = useMemo(() => multiplyModulate(inherited, selfModulate), [inherited, selfModulate]);
  const color = useGodotLinearColor(own);
  // Memoised as a whole: it is a prop, and painters memoise on it.
  return useMemo(() => ({ own, color, opacity: own.a }), [own, color]);
}
