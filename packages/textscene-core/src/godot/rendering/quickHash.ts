/**
 * Godot's per-pixel hash as GLSL: `quick_hash` in `scene_forward_lights_inc.glsl:278-281`, which
 * `interleaved_gradient_noise` in `sky.glsl:143-147` repeats. The soft shadow turn and the sky's
 * debanding noise both concatenate this one text. The guard lets one program hold it twice.
 */

/** The hash of `pixel`, Godot's `gl_FragCoord.xy`, in [0, 1). */
export const GODOT_QUICK_HASH_GLSL = /* glsl */ `
#ifndef GODOT_QUICK_HASH
#define GODOT_QUICK_HASH
float godotQuickHash(vec2 pixel) {
  const vec3 magic = vec3(0.06711056, 0.00583715, 52.9829189);
  return fract(magic.z * fract(dot(pixel, magic.xy)));
}
#endif
`;
