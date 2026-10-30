/**
 * Where a viewport under BG_CANVAS splits its canvas around the 3D render. Godot draws canvases
 * lowest layer first, and draws the 3D render right after the first canvas whose layer is at least
 * `background_canvas_max_layer`: before every canvas when the lowest layer is above it, and after
 * every canvas when none reaches it (`renderer_viewport.cpp:650-715`).
 */

import type * as THREE from 'three';
import { canvasKeyBound, layerRankOf } from '../../../r3f/canvasPaintOrder';
import { showBackground } from '../../../r3f/environment/sceneEnvironment';
import type { EnvironmentSettings } from '../../../resources/environment/types';
import { BackgroundMode } from '../../../godot/scene/environment';

/**
 * The paint-order key below which an item draws behind the 3D render, or null when nothing does:
 * another mode, or a lowest layer above the max layer. Plus infinity when the 3D render comes last.
 * `drawnLayers` are this viewport's canvas layers, lowest first (`layerRanks`), and `sceneRanks`
 * are the ranks the items' keys were built from (`useLayerRanks`).
 */
export function canvasBackdropBound(
  background: EnvironmentSettings['background'] | undefined,
  drawnLayers: readonly number[],
  sceneRanks: readonly number[]
): number | null {
  if (background?.mode !== BackgroundMode.BG_CANVAS) return null;
  const { canvasMaxLayer } = background;
  if (drawnLayers[0]! > canvasMaxLayer) return null;
  const firstAtOrAboveMax = drawnLayers.find((layer) => layer >= canvasMaxLayer);
  if (firstAtOrAboveMax === undefined) return Number.POSITIVE_INFINITY;
  return canvasKeyBound(layerRankOf(sceneRanks, firstAtOrAboveMax) + 1);
}

/** Runs `draw` with `texture` as the background of `scene`, and puts the scene back. */
export function drawOverBackground<T>(scene: THREE.Scene, texture: THREE.Texture, draw: () => T): T {
  const restore = showBackground(scene, texture, 1);
  try {
    return draw();
  } finally {
    restore();
  }
}
