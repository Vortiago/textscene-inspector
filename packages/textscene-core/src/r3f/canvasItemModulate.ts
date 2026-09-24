/**
 * Godot's CanvasItem tint. `modulate` multiplies onto the node and every
 * descendant through context, and `self_modulate` onto the node's own pixels.
 * `useCanvasItemTint` resolves both, with the material colour converted from the
 * authored sRGB to linear, as Godot's canvas does.
 */

import { createContext, useContext, useMemo } from 'react';
import type * as THREE from 'three';
import { useGodotLinearColor } from './godotColor';

export interface RGBA {
  r: number;
  g: number;
  b: number;
  a: number;
}

export const WHITE_MODULATE: RGBA = { r: 1, g: 1, b: 1, a: 1 };

export const Modulate2DContext = createContext<RGBA>(WHITE_MODULATE);

export function useParentModulate(): RGBA {
  return useContext(Modulate2DContext);
}

/** Component-wise RGBA multiply (Godot composes modulate by multiplication). */
export function multiplyModulate(a: RGBA, b: RGBA): RGBA {
  return { r: a.r * b.r, g: a.g * b.g, b: a.b * b.b, a: a.a * b.a };
}

export interface CanvasItemTint {
  /** Ancestor modulate × this node's `modulate`, for the child context. */
  inherited: RGBA;
  /**
   * The sRGB own-pixel product, `inherited` × `self_modulate`, for a body that
   * composes a further tint, such as a TileMap layer's, before the one conversion
   * to linear.
   */
  own: RGBA;
  /** Linear-space own-pixel tint (`inherited` × `self_modulate`). */
  color: THREE.Color;
  /** Own-pixel opacity (`inherited.a` × `self_modulate.a`). */
  opacity: number;
}

/** Resolve a CanvasItem's modulate/self_modulate into a material tint + child-context value. */
export function useCanvasItemTint(
  props: { modulate: RGBA; self_modulate: RGBA },
  /**
   * A tint on this item's own pixels that is not passed on: the canvas modulate,
   * which Godot multiplies in per item in the base pass.
   */
  ownMultiplier: RGBA = WHITE_MODULATE
): CanvasItemTint {
  const parent = useParentModulate();
  const inherited = useMemo(() => multiplyModulate(parent, props.modulate), [parent, props.modulate]);
  const self = useMemo(() => multiplyModulate(inherited, props.self_modulate), [inherited, props.self_modulate]);
  const own = useMemo(() => multiplyModulate(self, ownMultiplier), [self, ownMultiplier]);
  const color = useGodotLinearColor(own);
  return { inherited, own, color, opacity: own.a };
}
