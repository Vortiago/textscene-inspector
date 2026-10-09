/**
 * A geometry instance's fade as the Forward+ renderer draws it: one alpha for every surface of the
 * instance, from its `transparency` and its visibility-range fade, and a switch that moves them all
 * to the alpha pass. Mobile and Compatibility ignore both (`visual_instance_3d.cpp:524,528`).
 */

import { clamp } from './math.js';
import { unitByte } from './unitByte.js';

/**
 * `FADE_ALPHA_PASS_THRESHOLD` (`render_forward_clustered.cpp:47`): a geometry instance whose fade
 * is below it draws every surface in the alpha pass (`:1128`), never the opaque or depth pass.
 */
const FADE_ALPHA_PASS_THRESHOLD = 0.999;

/** `force_alpha = CLAMP(1.0 - p_transparency, 0, 1)` (`renderer_geometry_instance.cpp:110`), in float. */
function forceAlpha(transparency: number): number {
  return clamp(Math.fround(1 - Math.fround(transparency)), 0, 1);
}

/**
 * The instance's fade: the visibility-range fade times `force_alpha`, in float
 * (`render_forward_clustered.cpp:979`). `rangeFade` is 1 outside a SELF fade's margins.
 */
export function geometryFade(transparency: number, rangeFade: number): number {
  return Math.fround(rangeFade * forceAlpha(transparency));
}

/**
 * The fade alpha the scene shader starts from, before a material multiplies its own in
 * (`scene_forward_clustered.glsl:1251,1357`): the fade as the 8-bit flags field holds it (`:981`).
 */
export function fadeAlpha(fade: number): number {
  return unitByte(fade);
}

/** Whether every surface of an instance with this fade draws in the alpha pass. */
export function forcesAlphaPass(fade: number): boolean {
  return fade < FADE_ALPHA_PASS_THRESHOLD;
}
