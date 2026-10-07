/**
 * `GeometryInstance3D.transparency` as the Forward+ renderer draws it: one alpha for every
 * surface of the instance, and a switch that moves them all to the alpha pass. Mobile and
 * Compatibility ignore it (`visual_instance_3d.cpp:524`).
 */

import { clamp } from './math.js';
import { unitByte } from './unitByte.js';

/**
 * `FADE_ALPHA_PASS_THRESHOLD` (`render_forward_clustered.cpp:47`): a geometry instance whose
 * `force_alpha` is below it draws every surface in the alpha pass (`:1128`), never the opaque or depth pass.
 */
const FADE_ALPHA_PASS_THRESHOLD = 0.999;

/** `force_alpha = CLAMP(1.0 - p_transparency, 0, 1)` (`renderer_geometry_instance.cpp:110`), in float. */
function forceAlpha(transparency: number): number {
  return clamp(Math.fround(1 - Math.fround(transparency)), 0, 1);
}

/**
 * The fade alpha the scene shader starts from, before a material multiplies its own in
 * (`scene_forward_clustered.glsl:1251,1357`): `force_alpha` as the 8-bit flags field holds it.
 */
export function fadeAlpha(transparency: number): number {
  return unitByte(forceAlpha(transparency));
}

/** Whether every surface of the instance draws in the alpha pass. */
export function forcesAlphaPass(transparency: number): boolean {
  return forceAlpha(transparency) < FADE_ALPHA_PASS_THRESHOLD;
}
