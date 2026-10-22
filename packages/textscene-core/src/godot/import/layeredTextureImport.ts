/**
 * Godot's layered importer in its 3D and 2D array modes
 * (`editor/import/resource_importer_layered_texture.cpp`): the importer a sidecar names, and the
 * slices it cuts the image into.
 */

/** The importer a sidecar names for a 2D texture array (`resource_importer_layered_texture.cpp:47-48`). */
export const TEXTURE_2D_ARRAY_IMPORTER = '2d_array_texture';

/** The importer a sidecar names for a 3D texture (`resource_importer_layered_texture.cpp:53-54`). */
export const TEXTURE_3D_IMPORTER = '3d_texture';

/** The slices across and down the image. Both modes read them (`:157-160`). */
export interface ImportSlices {
  horizontal: number;
  vertical: number;
}

/** The importer's default for each count (`resource_importer_layered_texture.cpp:158-159`). */
export const DEFAULT_SLICES = 8;
