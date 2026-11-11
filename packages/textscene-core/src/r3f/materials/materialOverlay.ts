/** How a GeometryInstance3D's `material_overlay` draw is picked and hooked. */

import type * as THREE from 'three';
import type { SurfaceDrawHooks } from '../surfaceDrawHooks';

/**
 * Opts a draw out of picking: three calls `raycast` and collects nothing. The base draw is the
 * node's pickable body, and a coincident second hit would report the same node twice.
 *
 * @canonical A draw that picking skips
 */
export const NO_RAYCAST: THREE.Object3D['raycast'] = () => {};

/**
 * The props of an overlay's draw: never picked, and under the colour pair of the base draw's
 * hooks, as the overlay casts nothing of its own. Its owner sets its order.
 */
export function overlayDrawProps({ onBeforeRender, onAfterRender }: SurfaceDrawHooks) {
  return { raycast: NO_RAYCAST, onBeforeRender, onAfterRender };
}
