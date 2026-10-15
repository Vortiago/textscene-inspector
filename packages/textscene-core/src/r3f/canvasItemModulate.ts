/**
 * Godot's CanvasItem tint. `modulate` multiplies onto the node and every
 * descendant through context, and `self_modulate` onto the node's own pixels.
 * `useCanvasItemTint` resolves both, with the material colour converted from the
 * authored sRGB to linear, as Godot's canvas does.
 */

import { createContext, useContext, useMemo } from 'react';
import type * as THREE from 'three';
import { useGodotLinearColor } from './godotColor';
import type { Rgba } from '../godot/math/math';

export const WHITE_MODULATE: Rgba = { r: 1, g: 1, b: 1, a: 1 };

export const Modulate2DContext = createContext<Rgba>(WHITE_MODULATE);

export function useParentModulate(): Rgba {
  return useContext(Modulate2DContext);
}

/** Component-wise RGBA multiply (Godot composes modulate by multiplication). */
export function multiplyModulate(a: Rgba, b: Rgba): Rgba {
  return { r: a.r * b.r, g: a.g * b.g, b: a.b * b.b, a: a.a * b.a };
}

export interface CanvasItemTint {
  /** Ancestor modulate × this node's `modulate`, for the child context. */
  inherited: Rgba;
  /**
   * `inherited` × `self_modulate` in sRGB, before the canvas tint, for a body whose child items
   * each decide whether the canvas tint reaches them, as a tile layer's do.
   */
  self: Rgba;
  /**
   * The sRGB own-pixel product, `self` × the own multiplier, for a body that composes a further
   * tint before the one conversion to linear.
   */
  own: Rgba;
  /** Linear-space own-pixel tint, `own` converted. */
  color: THREE.Color;
  /** Own-pixel opacity, `own.a`. */
  opacity: number;
}

/** Resolve a CanvasItem's modulate/self_modulate into a material tint + child-context value. */
export function useCanvasItemTint(
  props: { modulate: Rgba; self_modulate: Rgba },
  /**
   * A tint on this item's own pixels that is not passed on: the canvas modulate,
   * which Godot multiplies in per item in the base pass.
   */
  ownMultiplier: Rgba = WHITE_MODULATE
): CanvasItemTint {
  const parent = useParentModulate();
  const inherited = useMemo(() => multiplyModulate(parent, props.modulate), [parent, props.modulate]);
  const self = useMemo(
    () => multiplyModulate(inherited, props.self_modulate),
    [inherited, props.self_modulate]
  );
  const own = useMemo(() => multiplyModulate(self, ownMultiplier), [self, ownMultiplier]);
  const color = useGodotLinearColor(own);
  return { inherited, self, own, color, opacity: own.a };
}
