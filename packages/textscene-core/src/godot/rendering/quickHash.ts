/** `quick_hash` of a pixel in [0, 1) (`scene_forward_lights_inc.glsl:278-281`), guarded to allow two. */
export const GODOT_QUICK_HASH_GLSL = /* glsl */ `
#ifndef GODOT_QUICK_HASH
#define GODOT_QUICK_HASH
float godotQuickHash(vec2 pixel) {
  const vec3 magic = vec3(0.06711056, 0.00583715, 52.9829189);
  return fract(magic.z * fract(dot(pixel, magic.xy)));
}
#endif
`;
