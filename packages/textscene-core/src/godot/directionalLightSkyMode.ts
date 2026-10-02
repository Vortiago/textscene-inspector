/**
 * What a DirectionalLight3D's `sky_mode` lets it reach. Godot's scene shader and sky shader read a
 * light apart, so a light can light surfaces, draw its sun in the sky, or both.
 */

/** `DirectionalLight3D::SkyMode` (`scene/3d/light_3d.h:172-176`). */
export const DirectionalLightSkyMode = {
  LIGHT_AND_SKY: 0,
  LIGHT_ONLY: 1,
  SKY_ONLY: 2,
} as const;

/** `DirectionalLight3D()` lights both the scene and the sky (`scene/3d/light_3d.cpp:608`). */
export const DIRECTIONAL_LIGHT_SKY_MODE_DEFAULT = DirectionalLightSkyMode.LIGHT_AND_SKY;

/** `light_storage.cpp:632`: the scene shader skips a Sky Only light, so it lights no surface. */
export function directionalLightLightsSurfaces(skyMode: number): boolean {
  return skyMode !== DirectionalLightSkyMode.SKY_ONLY;
}

/** `sky.cpp:1069`: the sky shader skips a Light Only light, so it draws no disc in the sky. */
export function directionalLightDrawsInSky(skyMode: number): boolean {
  return skyMode !== DirectionalLightSkyMode.LIGHT_ONLY;
}
