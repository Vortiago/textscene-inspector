/**
 * Godot's CanvasItem tint. `modulate` multiplies onto the node and every
 * descendant through context, and `self_modulate` onto the node's own pixels.
 * `useCanvasItemTint` resolves both, with the material colour converted from the
 * authored sRGB to linear, as Godot's canvas does. In a linear canvas the canvas modulate
 * converts on its own and multiplies after (`renderer_canvas_render_rd.cpp:692-693`).
 */

import { createContext, useContext, useMemo } from 'react';
import * as THREE from 'three';
import { godotColorToLinear, useGodotLinearColor } from './godotColor';
import { useCanvasColorSpace, type CanvasColorSpace } from './canvasColorSpace';
import type { Rgba } from '../godot/math/math';

export const WHITE_MODULATE: Rgba = { r: 1, g: 1, b: 1, a: 1 };

/**
 * Component-wise RGBA multiply (Godot composes modulate by multiplication), in double, not
 * `multiplyColor`: the double keeps our sRGB round trip on Godot's output at a half step, so
 * `font_color` 0.9 writes 230 as Godot does. The test "keeps a 0.9 channel" pins it.
 */
export function multiplyModulate(a: Rgba, b: Rgba): Rgba {
  return { r: a.r * b.r, g: a.g * b.g, b: a.b * b.b, a: a.a * b.a };
}

/**
 * The tint of a canvas item's own pixels: the type a Control painter is handed. It names no value
 * the descendants inherit, so no painter can re-enter the modulate chain.
 */
export interface OwnPixelTint {
  /**
   * The sRGB own-pixel product, for a body that composes a further tint before the conversion to
   * linear: `self` × the own multiplier in an sRGB canvas. In a linear canvas only the multiplier's
   * alpha folds in, since its colour multiplies after the conversion.
   */
  own: Rgba;
  /** Linear-space own-pixel tint: `own` converted, times the canvas modulate of a linear canvas. */
  color: THREE.Color;
  /** Own-pixel opacity, `own.a`. */
  opacity: number;
}

/** The parts of the own-pixel tint that the fold computes. */
export interface FoldedOwnPixelTint extends OwnPixelTint {
  /**
   * The linear colour every own pixel multiplies after its conversion: the canvas modulate in a
   * linear canvas, white in an sRGB one, whose `own` holds it already.
   */
  canvasModulate: THREE.Color;
}

const LINEAR_WHITE = new THREE.Color(1, 1, 1);

/**
 * `self` × the item's canvas modulate in `space`. An sRGB canvas multiplies the sRGB numbers and
 * converts once. A linear canvas converts each apart and multiplies the linear values
 * (`canvas.glsl:720`), so a value above 1 stays above 1. A caller that memoises the converted
 * canvas modulate passes it as `linearModulate`, so its identity holds across folds.
 */
export function foldOwnPixelTint(
  self: Rgba,
  canvasModulate: Rgba,
  space: CanvasColorSpace,
  linearModulate: THREE.Color = godotColorToLinear(canvasModulate)
): FoldedOwnPixelTint {
  if (!space.isLinear) {
    const own = multiplyModulate(self, canvasModulate);
    return { own, color: godotColorToLinear(own), opacity: own.a, canvasModulate: LINEAR_WHITE };
  }
  const own = { ...self, a: self.a * canvasModulate.a };
  return {
    own,
    color: godotColorToLinear(own).multiply(linearModulate),
    opacity: own.a,
    canvasModulate: linearModulate,
  };
}

export interface CanvasItemTint extends FoldedOwnPixelTint {
  /** Ancestor modulate × this node's `modulate`, for the child context. */
  inherited: Rgba;
  /**
   * `inherited` × `self_modulate` in sRGB, before the canvas tint, for a body whose child items
   * each decide whether the canvas tint reaches them, as a tile layer's do.
   */
  self: Rgba;
  /**
   * The own-pixel tint of a child canvas item whose `modulate` and `self_modulate` are white: the
   * inherited product without this node's `self_modulate`, which Godot multiplies into the item's
   * own commands only (`renderer_canvas_cull.cpp:268`). An internal child Control takes this one.
   */
  internalChild: FoldedOwnPixelTint;
}

/**
 * Written around one item's own pixels by its group: the canvas modulate those pixels multiply
 * after their conversion to linear, white unless the canvas is linear.
 */
const OwnCanvasModulateContext = createContext<THREE.Color>(LINEAR_WHITE);
OwnCanvasModulateContext.displayName = 'OwnCanvasModulateContext';

export const OwnCanvasModulateProvider = OwnCanvasModulateContext.Provider;

/**
 * The linear colour the item's own pixels draw an sRGB colour `c` with: `c` composed from the
 * tint's `own`, converted, times the canvas modulate of a linear canvas. Memoised on the values.
 *
 * @canonical The linear colour of an sRGB colour a canvas item draws
 */
export function useItemLinearColor(c: Pick<Rgba, 'r' | 'g' | 'b'>): THREE.Color {
  const toLinear = useItemLinearColorOf();
  const { r, g, b } = c;
  return useMemo(() => toLinear({ r, g, b, a: 1 }), [toLinear, r, g, b]);
}

/** `useItemLinearColor` as a function, for a painter that converts colours in a loop or a callback. */
export function useItemLinearColorOf(): (c: Rgba) => THREE.Color {
  const canvasModulate = useContext(OwnCanvasModulateContext);
  return useMemo(() => (c: Rgba) => godotColorToLinear(c).multiply(canvasModulate), [canvasModulate]);
}

/**
 * `useItemLinearColorOf` for an array colour, the colour a mesh or a triangle array carries per
 * vertex: `own × color` converted once in an sRGB canvas, and `color` converted apart from the tint
 * in a linear one, which decodes vertex attributes on their own (`canvas.glsl:176-178`).
 */
export function useArrayColorOf(): (own: Rgba, color: Rgba) => THREE.Color {
  const toLinear = useItemLinearColorOf();
  const { isLinear } = useCanvasColorSpace();
  return useMemo(
    () => (own: Rgba, color: Rgba) =>
      isLinear ? toLinear(own).multiply(godotColorToLinear(color)) : toLinear(multiplyModulate(own, color)),
    [toLinear, isLinear]
  );
}

/** Where a painter that writes sRGB vertex colours carries the item's tint. */
export interface VertexColorTint {
  /** The factor each vertex colour takes: the tint in an sRGB canvas, white in a linear one. */
  vertex: Rgba;
  /** The material's linear colour: white in an sRGB canvas, the converted tint in a linear one. */
  color: THREE.Color;
  opacity: number;
  defines: Readonly<Record<string, string>>;
}

/**
 * The tint `own` of a painter whose triangles carry sRGB vertex colours. An sRGB canvas multiplies
 * the tint into the colours and decodes the product once. A linear canvas decodes the colours apart
 * and multiplies the converted tint (`renderer_canvas_render_rd.cpp:2645-2648`).
 *
 * @canonical The tint of a canvas painter that writes sRGB vertex colours
 */
export function useVertexColorTint(own: Rgba): VertexColorTint {
  const space = useCanvasColorSpace();
  const linearOwn = useItemLinearColor(own);
  return useMemo(
    () =>
      space.isLinear
        ? { vertex: WHITE_MODULATE, color: linearOwn, opacity: own.a, defines: space.defines }
        : { vertex: own, color: LINEAR_WHITE, opacity: 1, defines: space.defines },
    [space, linearOwn, own]
  );
}

/** A CanvasItem's modulate and self_modulate as its own pixels' tint and the product its children inherit. */
export function useCanvasItemTint(
  props: { modulate: Rgba; self_modulate: Rgba },
  /** The modulate product the item inherits. */
  parent: Rgba,
  /**
   * A tint on this item's own pixels that is not passed on: the canvas modulate,
   * which Godot multiplies in per item in the base pass.
   */
  ownMultiplier: Rgba = WHITE_MODULATE
): CanvasItemTint {
  const inherited = useMemo(() => multiplyModulate(parent, props.modulate), [parent, props.modulate]);
  const self = useMemo(
    () => multiplyModulate(inherited, props.self_modulate),
    [inherited, props.self_modulate]
  );
  const space = useCanvasColorSpace();
  const linearModulate = useGodotLinearColor(ownMultiplier);
  // Its own memo: it does not read `self_modulate`, so animating that leaves its identity alone.
  const internalChild = useMemo(
    () => foldOwnPixelTint(inherited, ownMultiplier, space, linearModulate),
    [inherited, ownMultiplier, space, linearModulate]
  );
  // Memoised as a whole: a Control painter takes it as a prop and memoises on it.
  return useMemo(
    () => ({
      inherited,
      self,
      ...foldOwnPixelTint(self, ownMultiplier, space, linearModulate),
      internalChild,
    }),
    [inherited, self, ownMultiplier, space, linearModulate, internalChild]
  );
}
