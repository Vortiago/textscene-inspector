/** Godot 4.7.2's area light atlas, the one texture every AreaLight3D's projector samples. */

/** The atlas's mip count (4.7.2 `servers/rendering/renderer_rd/storage_rd/texture_storage.h:278`). */
export const AREA_LIGHT_ATLAS_MIPMAPS = 8;

/**
 * `copy.glsl`'s blur kernel without glow, from the centre tap out (4.7.2
 * `servers/rendering/renderer_rd/shaders/effects/copy.glsl:119`), which builds each mip from the one above.
 */
export const AREA_LIGHT_ATLAS_BLUR_KERNEL = [0.214607, 0.189879, 0.131514, 0.071303] as const;

/** The blur's thread groups are 8 texels wide, and each reads its own window (`copy.glsl:9`). */
export const AREA_LIGHT_ATLAS_BLUR_GROUP_SIDE = 8;
