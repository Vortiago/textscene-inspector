/** Where a GeometryInstance3D's `material_overlay` draws among three's objects, and how it is picked. */

import type * as THREE from 'three';
import type { SurfaceDrawHooks } from '../surfaceDrawHooks';

/**
 * The overlay's draw-order key. Any value above the 3D default (0) puts it after its own surface. 1
 * keeps it as close to that surface as three allows, since every step also steps it past unrelated
 * content at the same depth. Godot appends the overlay after the surface's own material chain.
 *
 * @canonical The draw order of a material overlay
 */
export const MATERIAL_OVERLAY_RENDER_ORDER = 1;

/**
 * Opts a draw out of picking: three calls `raycast` and collects nothing. The base draw is the
 * node's pickable body, and a coincident second hit would report the same node twice.
 *
 * @canonical A draw that picking skips
 */
export const NO_RAYCAST: THREE.Object3D['raycast'] = () => {};

/**
 * The props of an overlay's draw: after the surface, never picked, and under the colour pair of the
 * base draw's hooks, as the overlay casts nothing of its own.
 */
export function overlayDrawProps({ onBeforeRender, onAfterRender }: SurfaceDrawHooks) {
  return { renderOrder: MATERIAL_OVERLAY_RENDER_ORDER, raycast: NO_RAYCAST, onBeforeRender, onAfterRender };
}
