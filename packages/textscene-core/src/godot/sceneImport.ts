/** The scene importer's lightmap options (`editor/import/3d/resource_importer_scene.{h,cpp}`). */

/** `LightBakeMode` (`resource_importer_scene.h:159-164`). */
export enum LightBakeMode {
  Disabled = 0,
  Static = 1,
  StaticLightmaps = 2,
  Dynamic = 3,
}

/** `meshes/light_baking`'s default (`resource_importer_scene.cpp:2527`). */
export const DEFAULT_LIGHT_BAKE_MODE = LightBakeMode.Static;

/** `MeshOverride` (`resource_importer_scene.h:186-190`), a mesh's `generate/lightmap_uv`. */
export enum MeshOverride {
  Default = 0,
  Enable = 1,
  Disable = 2,
}

/** `meshes/lightmap_texel_size`'s default (`resource_importer_scene.cpp:2528`). */
export const DEFAULT_LIGHTMAP_TEXEL_SIZE = 0.2;

/**
 * The texel size the importer unwraps at: the option as a float, raised to at least 0.001 by
 * `MAX` (`resource_importer_scene.cpp:3242-3243`), which keeps a NaN.
 */
export function unwrapTexelSize(option: number): number {
  const texelSize = Math.fround(option);
  return Math.fround(0.001 > texelSize ? 0.001 : texelSize);
}
