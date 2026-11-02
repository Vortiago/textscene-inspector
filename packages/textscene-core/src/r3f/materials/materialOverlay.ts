/** Where a GeometryInstance3D's `material_overlay` draws among three's objects, and how it is picked. */

import type * as THREE from 'three';
import type { SurfaceDrawHooks } from '../surfaceDrawHooks';

/**
 * The overlay's draw-order seed. The next_pass scheme orders a part's draws 0..k: the
 * surface's own draw at 0, each chain link at its index, and the overlay one past the
 * greatest ordinal any chain reached (`nextPassRenderOrder`). This is that value for a
 * part with no chain — ordinal 1, after the surface — and any value above the 3D
 * default keeps the overlay after its own surface when the call site writes the
 * explicit computed order over it.
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
