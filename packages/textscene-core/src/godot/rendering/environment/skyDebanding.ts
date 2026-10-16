/**
 * Godot's sky debanding noise as GLSL, `interleaved_gradient_noise` in `sky.glsl:142-147`. A sky that
 * debands adds it at each pixel it draws: the background's and the radiance octmap's
 * (`sky.glsl:313-315`). Both concatenate this one text, so the two noises never drift apart.
 */

import { GODOT_QUICK_HASH_GLSL } from '../quickHash.js';

/** The noise at `pixel`, Godot's `gl_FragCoord.xy`, up to 1/255 on each channel. */
export const GODOT_DEBANDING_NOISE_GLSL = /* glsl */ `${GODOT_QUICK_HASH_GLSL}
vec3 godotDebandingNoise(vec2 pixel) {
  float noise = godotQuickHash(pixel) * 2.0 - 1.0;
  return vec3(noise, -noise, noise) / 255.0;
}
`;
