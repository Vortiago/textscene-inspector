/**
 * How Godot 4.7.2's forward renderer sets up an AreaLight3D's shadow: one paraboloid facing the
 * light's -Z in one slot of the positional shadow atlas, the casters it renders and its depth
 * range. Its soft shadow is an omni light's (`positionalSoftShadow`). Godot 4.6.3 has no AreaLight3D.
 */

import { LIGHT_BUFFER_MIN_RANGE } from './lightBufferRange.js';

/** The rectangle's side lengths, `area_size`. */
interface AreaSize {
  x: number;
  y: number;
}

function halfDiagonal(size: AreaSize): number {
  return Math.hypot(size.x, size.y) / 2;
}

/**
 * The far plane the paraboloid renders to: the range plus half the rectangle's diagonal, so the
 * map reaches a fragment one range from the rectangle's corner (4.7.2
 * `render_forward_clustered.cpp:2755-2758`).
 */
export function areaLightShadowFar(range: number, size: AreaSize): number {
  return range + halfDiagonal(size);
}

/**
 * The lookup's `inv_center_range`: one over the far plane, from the range the light buffer holds
 * (4.7.2 `light_storage.cpp:1060`, `:1092`).
 */
export function areaLightShadowDepthScale(range: number, size: AreaSize): number {
  return 1 / areaLightShadowFar(Math.max(LIGHT_BUFFER_MIN_RANGE, range), size);
}

/** A box in the light's own space, its corners at `min` and `max`. */
export interface AreaLightBox {
  min: readonly [number, number, number];
  max: readonly [number, number, number];
}

/**
 * The light's volume: the range in front of the rectangle, widened by its half sides (4.7.2
 * `light_storage.cpp:529-534`). The cull hands the shadow every caster inside the same box
 * (`renderer_scene_cull.cpp:2604-2616`).
 */
export function areaLightBounds(range: number, size: AreaSize): AreaLightBox {
  const width = size.x / 2 + range;
  const height = size.y / 2 + range;
  return { min: [-width, -height, -range], max: [width, height, 0] };
}

/**
 * The distance the cull projects onto the screen to choose the light's slot: the range plus the
 * whole diagonal (4.7.2 `renderer_scene_cull.cpp:3573-3575`).
 */
export function areaLightShadowCoverageRadius(range: number, size: AreaSize): number {
  return range + Math.hypot(size.x, size.y);
}
