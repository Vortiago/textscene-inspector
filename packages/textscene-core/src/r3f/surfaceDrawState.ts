import type * as THREE from 'three';
import { followVisualLayers, setVisualLayers, visualLayersOf } from './visualLayers.js';

/** What every draw of a surface takes from the object that holds the surface, with its visual layers. */
export const SURFACE_DRAW_STATE = [
  'frustumCulled',
  'castShadow',
  'onBeforeRender',
  'onAfterRender',
  'onBeforeShadow',
  'onAfterShadow',
] as const;

type DrawStateKey = (typeof SURFACE_DRAW_STATE)[number] | 'receiveShadow' | 'renderOrder' | 'layers';

/**
 * `draw` draws as `holder` does now: a draw that sets its own render order and shadow receipt.
 *
 * @canonical The draw state a draw copies from its holder
 */
export function copySurfaceDrawState(draw: THREE.Object3D, holder: THREE.Object3D): void {
  for (const key of SURFACE_DRAW_STATE) (draw as unknown as Record<string, unknown>)[key] = holder[key];
  setVisualLayers(draw, visualLayersOf(holder));
}

/**
 * `draw` draws as `holder` does at each draw, so a live edit of the holder reaches it.
 *
 * @canonical The draw state a draw follows from its holder
 */
export function followSurfaceDrawState(
  draw: THREE.Object3D,
  holder: THREE.Object3D,
  keys: readonly DrawStateKey[]
): void {
  // A walk that writes `draw` writes its holder too, which `draw` reads, so the write is dropped.
  for (const key of keys) Object.defineProperty(draw, key, { get: () => holder[key], set: () => {} });
  followVisualLayers(draw, holder);
}
