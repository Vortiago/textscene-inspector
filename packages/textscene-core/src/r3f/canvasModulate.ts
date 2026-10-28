/**
 * Which `CanvasModulate` colour is in force for a canvas. Godot sets it with
 * `RS::canvas_set_modulate` on ENTER_CANVAS, so it tints the whole canvas wherever
 * it sits. The last one in pre-order wins, and a hidden one (`is_visible_in_tree()`)
 * does not apply.
 */

import { createContext, useContext, useMemo } from 'react';
import type { TscnNode } from '../parser/types.js';
import { liveTreeOf, type LiveTreeContext } from './liveSceneTree.js';
import { useSharedLiveTree } from './useLiveSceneTree.js';
import { isViewportBoundary } from '../nodes/viewport/subviewport/viewportBoundary.js';
import { WHITE_MODULATE } from './canvasItemModulate.js';
import { CANVAS_MODULATE_FLOOR } from './lighting2d/canvasItemLighting.js';
import { type CanvasItemMaterialProperties } from '../resources/materials/canvasitemmaterial/types.js';
import type { Rgba } from '../godot/math/math.js';
import { CanvasItemMaterialLightMode } from '../godot/scene/canvasItemMaterial.js';

interface CanvasModulateLike {
  color?: Rgba;
  visible?: boolean;
}

/**
 * The canvas-wide tint for the nodes of one canvas, white with no visible CanvasModulate. It reads
 * the live tree over `ctx`, so a CanvasModulate inside an instanced sub-scene counts the moment
 * that sub-scene is loaded: it joins the group of the canvas it sits in, whichever file declares
 * it (`canvas_modulate.cpp:33-45`).
 */
export function canvasModulateColor(nodes: readonly TscnNode[], ctx: LiveTreeContext): Rgba {
  let found: Rgba | null = null;

  liveTreeOf(nodes, ctx).fold<boolean, void>(true, ({ step }, visible, descend) => {
    const { node } = step;
    // A CanvasLayer and a SubViewport are canvases of their own (`viewport.cpp:5345`): a
    // CanvasModulate inside tints that canvas, not this one.
    if (node.type === 'CanvasLayer' || isViewportBoundary(node.type)) return;
    const props = node.properties as CanvasModulateLike;
    const shown = visible && props.visible !== false;
    if (node.type === 'CanvasModulate' && shown && props.color) found = props.color;
    descend(shown);
  });
  return found ?? WHITE_MODULATE;
}

/** The sub-scenes the loader holds, which is none before a scene graph exists. */
const NO_SCENES: LiveTreeContext = {
  externalResources: [],
  internalResources: [],
  sceneCache: { getCached: () => null },
};

/** {@link canvasModulateColor} over the scenes the loader holds now. */
export function useCanvasModulateColor(nodes: readonly TscnNode[]): Rgba {
  const ctx = useSharedLiveTree()?.ctx ?? NO_SCENES;
  return useMemo(() => canvasModulateColor(nodes, ctx), [nodes, ctx]);
}

/**
 * The canvas tint, kept out of the inherited modulate: Godot applies it once per
 * item in the base pass, under the light-mode guard (`canvas.glsl`:
 * `#elif !defined(MODE_UNSHADED) color *= canvas_modulation;`).
 */
export const CanvasModulateContext = createContext<Rgba>(WHITE_MODULATE);
CanvasModulateContext.displayName = 'CanvasModulateContext';

/** The canvas tint in force, ungated by any item's light mode. */
export function useCanvasModulate(): Rgba {
  return useContext(CanvasModulateContext);
}

/**
 * The canvas tint this item multiplies into its own pixels, or white for an
 * `Unshaded` or `LightOnly` item, which Godot's guard excludes together.
 */
export function useCanvasModulateFor(material: CanvasItemMaterialProperties | null): Rgba {
  const canvasModulate = useContext(CanvasModulateContext);
  const shaded =
    (material?.lightMode ?? CanvasItemMaterialLightMode.NORMAL) === CanvasItemMaterialLightMode.NORMAL;
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
function floorCanvasModulate(color: Rgba): Rgba {
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
