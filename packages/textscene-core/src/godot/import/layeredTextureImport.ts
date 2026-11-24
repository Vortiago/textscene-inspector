/** The importer a sidecar names for a 2D texture array (`resource_importer_layered_texture.cpp:47-48`). */
export const TEXTURE_2D_ARRAY_IMPORTER = '2d_array_texture';

/** The importer a sidecar names for a 3D texture (`resource_importer_layered_texture.cpp:53-54`). */
export const TEXTURE_3D_IMPORTER = '3d_texture';

/** The importer a sidecar names for a cubemap (`resource_importer_layered_texture.cpp:44-45`). */
export const CUBEMAP_IMPORTER = 'cubemap_texture';

/** The slices across and down the image (`resource_importer_layered_texture.cpp:157-160`). */
export interface ImportSlices {
  horizontal: number;
  vertical: number;
}

/** The importer's default for each count (`resource_importer_layered_texture.cpp:158-159`). */
export const DEFAULT_SLICES = 8;

/** The slices of each `slices/arrangement`, 1x6 to 6x1 (`resource_importer_layered_texture.cpp:313-330`). */
export const CUBEMAP_ARRANGEMENTS: readonly ImportSlices[] = [
  { horizontal: 1, vertical: 6 },
  { horizontal: 2, vertical: 3 },
  { horizontal: 3, vertical: 2 },
  { horizontal: 6, vertical: 1 },
];

/** The slices a layered import cuts one image into, and whether it generates their mipmaps. */
export interface LayeredImport {
  readonly slices: ImportSlices;
  readonly hasMipmaps: boolean;
}

/** The importer's default arrangement, 2x3 (`resource_importer_layered_texture.cpp:162`). */
export const DEFAULT_CUBEMAP_ARRANGEMENT = 1;
