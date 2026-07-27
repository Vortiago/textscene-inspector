/**
 * Which `CanvasModulate` colour is in force for a canvas.
 *
 * A CanvasModulate does NOT tint its own subtree — it tints the whole canvas it
 * belongs to. Godot implements it as `RS::canvas_set_modulate(canvas, color)`
 * on ENTER_CANVAS, so the node's position in the tree is irrelevant and only
 * membership in the canvas matters. The isometric dungeon relies on exactly
 * that: its CanvasModulate is a CHILDLESS leaf beside the level, so a
 * subtree-scoped reading of it tints nothing at all.
 *
 * Two consequences of the "on enter" mechanism, both reproduced here:
 *   - Several CanvasModulates on one canvas do not compose; the LAST to enter
 *     wins, which is document (pre-order) order.
 *   - A hidden one does not apply. It is a CanvasItem, so `is_visible_in_tree()`
 *     gates it, and a hidden ancestor hides it with them.
 *
 * A `CanvasLayer` is its own canvas, so the walk does not descend into one.
 */

import { createContext, useContext, useMemo } from 'react';
import type { TscnNode } from '../parser/types.js';
import { WHITE_MODULATE, type RGBA } from './canvasItemModulate.js';
import { CANVAS_MODULATE_FLOOR } from './lighting2d/canvasItemLighting.js';
import {
  CanvasItemLightMode,
  type CanvasItemMaterialProperties,
} from '../resources/materials/canvasitemmaterial/types.js';

interface CanvasModulateLike {
  color?: RGBA;
  visible?: boolean;
}

/**
 * The canvas-wide tint for a scene's root nodes — white when the scene has no
 * (visible) CanvasModulate, which is the identity for the modulate product.
 *
 * KNOWN GAP: the walk sees authored nodes only, so a CanvasModulate living
 * inside an instanced sub-scene is not found. Godot would apply it.
 */
export function canvasModulateColor(nodes: readonly TscnNode[]): RGBA {
  let found: RGBA | null = null;

  const walk = (node: TscnNode, visible: boolean): void => {
    const props = node.properties as CanvasModulateLike;
    const shown = visible && props.visible !== false;
    // Not a CanvasItem: a CanvasLayer hosts its own canvas, which any
    // CanvasModulate inside it would tint instead of this one.
    if (node.type === 'CanvasLayer') return;
    if (node.type === 'CanvasModulate' && shown && props.color) found = props.color;
    for (const child of node.children) walk(child, shown);
  };

  for (const node of nodes) walk(node, true);
  return found ?? WHITE_MODULATE;
}

/**
 * The canvas tint in force, kept OUT of the inherited-modulate chain.
 *
 * Godot applies it per item in the base pass, guarded by the item's light mode
 * (`canvas.glsl`: `#elif !defined(MODE_UNSHADED) color *= canvas_modulation;`),
 * so folding it into the modulate every child inherits would apply it to items
 * that must not receive it — and apply it once per nesting level besides.
 */
export const CanvasModulateContext = createContext<RGBA>(WHITE_MODULATE);
CanvasModulateContext.displayName = 'CanvasModulateContext';

/** The canvas tint in force, ungated by any item's light mode. */
export function useCanvasModulate(): RGBA {
  return useContext(CanvasModulateContext);
}

/**
 * The canvas tint THIS item multiplies into its own pixels: the active
 * CanvasModulate, or white for an item the canvas tint must skip.
 *
 * Both `Unshaded` and `LightOnly` skip it — Godot's guard excludes them
 * together, since a light-only item shows nothing of its own base for the tint
 * to act on.
 *
 * The tint is FLOORED at one 8-bit step per channel. The 2D light injection
 * recovers an item's albedo by dividing this value back out (see
 * `lighting2d/canvasItemLighting`), and a zero channel would make that albedo
 * unrecoverable — a black CanvasModulate, the ordinary way to author night,
 * would then swallow every light on the canvas. The floor is below what an
 * 8-bit channel can show, and the lit result is unaffected either way because
 * the accumulator carries the true tint.
 */
export function useCanvasModulateFor(material: CanvasItemMaterialProperties | null): RGBA {
  const canvasModulate = useContext(CanvasModulateContext);
  const shaded = (material?.lightMode ?? CanvasItemLightMode.NORMAL) === CanvasItemLightMode.NORMAL;
  return useMemo(
    () => (shaded ? floorCanvasModulate(canvasModulate) : WHITE_MODULATE),
    [shaded, canvasModulate]
  );
}

function floorCanvasModulate(color: RGBA): RGBA {
  const { r, g, b } = color;
  if (r >= CANVAS_MODULATE_FLOOR && g >= CANVAS_MODULATE_FLOOR && b >= CANVAS_MODULATE_FLOOR) {
    return color;
  }
  return {
    r: Math.max(r, CANVAS_MODULATE_FLOOR),
    g: Math.max(g, CANVAS_MODULATE_FLOOR),
    b: Math.max(b, CANVAS_MODULATE_FLOOR),
    a: color.a,
  };
}
