/**
 * Which `CanvasModulate` colour is in force for a canvas. Godot sets it with
 * `RS::canvas_set_modulate` on ENTER_CANVAS, so it tints the whole canvas wherever
 * it sits. The last one in pre-order wins, and a hidden one (`is_visible_in_tree()`)
 * does not apply. A `CanvasLayer` is its own canvas, so the walk does not enter one.
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
 * The canvas-wide tint for a scene's root nodes, white with no visible
 * CanvasModulate. A CanvasModulate inside an instanced sub-scene is not found,
 * though Godot applies it.
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
 * The canvas tint, kept out of the inherited modulate: Godot applies it once per
 * item in the base pass, under the light-mode guard (`canvas.glsl`:
 * `#elif !defined(MODE_UNSHADED) color *= canvas_modulation;`).
 */
export const CanvasModulateContext = createContext<RGBA>(WHITE_MODULATE);
CanvasModulateContext.displayName = 'CanvasModulateContext';

/** The canvas tint in force, ungated by any item's light mode. */
export function useCanvasModulate(): RGBA {
  return useContext(CanvasModulateContext);
}

/**
 * The canvas tint this item multiplies into its own pixels, or white for an
 * `Unshaded` or `LightOnly` item, which Godot's guard excludes together.
 */
export function useCanvasModulateFor(material: CanvasItemMaterialProperties | null): RGBA {
  const canvasModulate = useContext(CanvasModulateContext);
  const shaded = (material?.lightMode ?? CanvasItemLightMode.NORMAL) === CanvasItemLightMode.NORMAL;
  return useMemo(
    () => (shaded ? floorCanvasModulate(canvasModulate) : WHITE_MODULATE),
    [shaded, canvasModulate]
  );
}

/**
 * Floored at one 8-bit step per channel: the 2D light injection divides the tint
 * back out to recover albedo (`lighting2d/canvasItemLighting`), and a black night
 * tint would swallow every light. The accumulator carries the true tint.
 */
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
