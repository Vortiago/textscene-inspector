/**
 * Godot CanvasItem tint, in two flavours:
 *  - `modulate` is hierarchical: a node's modulate multiplies onto all of its
 *    descendants' colors (and its own). We carry the accumulated parent modulate
 *    down the 2D subtree via context.
 *  - `self_modulate` multiplies onto the node's OWN pixels only and is NOT
 *    inherited by children.
 * `useCanvasItemTint` resolves both: it returns the `inherited` product to hand
 * to the child context, plus the linear-space `color`/`opacity` for this node's
 * material. TSCN colours are authored in sRGB → converted to the linear working
 * space before reaching the (unlit) 2D material, matching Godot's canvas.
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
  /** Ancestor modulate × this node's `modulate` — propagate to the child context. */
  inherited: RGBA;
  /**
   * The sRGB-space own-pixel product (`inherited` × `self_modulate`) — for
   * bodies that compose a further tint (e.g. a TileMap layer's modulate)
   * before the single sRGB→linear conversion.
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
   * A tint applied to this item's OWN pixels and not passed on — the canvas
   * modulate, which Godot multiplies in per item during the base pass rather
   * than inheriting down the tree.
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
