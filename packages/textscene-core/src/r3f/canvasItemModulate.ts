/**
 * Godot CanvasItem `modulate` is hierarchical: a node's modulate multiplies
 * onto all of its descendants' colors (and its own). We carry the accumulated
 * parent modulate down the 2D subtree via context; each 2D Component multiplies
 * its own modulate in, applies the product to its visible content, and provides
 * the product to its children. (`self_modulate`, which does NOT inherit, is a
 * separate later concern.)
 */

import { createContext, useContext } from 'react';

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
