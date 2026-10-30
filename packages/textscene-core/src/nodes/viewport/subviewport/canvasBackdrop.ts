/**
 * Where a viewport under BG_CANVAS splits its canvas around the 3D render. Godot draws canvases
 * lowest layer first, and draws the 3D render right after the first canvas whose layer is at least
 * `background_canvas_max_layer`: before every canvas when the lowest layer is above it, and after
 * every canvas when none reaches it (`renderer_viewport.cpp:650-715`).
 */

import type * as THREE from 'three';
import type { TscnNode } from '../../../parser/types';
import {
  canvasKeyBound,
  canvasLayerOf,
  isCanvasLayerType,
  layerRankOf,
  layerRanks,
} from '../../../r3f/canvasPaintOrder';
import { isViewportBoundary } from './viewportBoundary';

/** The layers of `children`'s canvases in this viewport: nested viewports draw their own. */
export function viewportCanvasLayers(children: readonly TscnNode[]): number[] {
  const found: number[] = [];
  const visit = (node: TscnNode): void => {
    if (isCanvasLayerType(node.type)) found.push(canvasLayerOf(node));
    if (!isViewportBoundary(node.type)) node.children.forEach(visit);
  };
  children.forEach(visit);
  return found;
}

/**
 * The paint-order key below which an item draws behind the 3D render: minus infinity when the 3D
 * render comes first, plus infinity when it comes last. `sceneRanks` are the ranks the items'
 * keys were built from (`useLayerRanks`).
 */
export function canvasBackdropBound(
  maxLayer: number,
  layers: readonly number[],
  sceneRanks: readonly number[]
): number {
  const drawn = layerRanks(layers);
  if (drawn[0]! > maxLayer) return Number.NEGATIVE_INFINITY;
  const last = drawn.find((layer) => layer >= maxLayer);
  if (last === undefined) return Number.POSITIVE_INFINITY;
  return canvasKeyBound(layerRankOf(sceneRanks, last) + 1);
}

/**
 * Runs `draw` with `texture` as the background of `scene`, at intensity 1, and puts the scene back.
 * A null `texture` draws what the scene holds.
 */
export function drawOverBackground<T>(scene: THREE.Scene, texture: THREE.Texture | null, draw: () => T): T {
  if (!texture) return draw();
  const { background, backgroundIntensity } = scene;
  scene.background = texture;
  scene.backgroundIntensity = 1;
  try {
    return draw();
  } finally {
    scene.background = background;
    scene.backgroundIntensity = backgroundIntensity;
  }
}
