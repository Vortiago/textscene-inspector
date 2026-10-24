/** Godot's decal atlas, the one texture every Decal's albedo is sampled from. */

/** The atlas's mip count (`servers/rendering/renderer_rd/storage_rd/texture_storage.h:274`). */
export const DECAL_ATLAS_MIPMAPS = 5;

/** The side of a cell, and so the padding around each texture (`texture_storage.cpp:3055`). */
export const DECAL_ATLAS_BORDER = 1 << DECAL_ATLAS_MIPMAPS;

/** The cells the base width starts at (`texture_storage.cpp:3064`). */
export const DECAL_ATLAS_MIN_COLUMNS = 8;
