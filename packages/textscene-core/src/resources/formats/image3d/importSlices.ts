/**
 * How Godot's layered importer cuts an image into the slices of a 3D texture
 * (`editor/import/resource_importer_layered_texture.cpp`), read from its **Import sidecar**.
 */

import type { ParsedImportFile } from '../../../parser/importParser';

/** The importer a sidecar names for a 3D texture (`resource_importer_layered_texture.cpp:53-54`). */
const TEXTURE_3D_IMPORTER = '3d_texture';

/** The slices across and down the image. */
export interface ImportSlices {
  horizontal: number;
  vertical: number;
}

/** The importer's default for each count (`resource_importer_layered_texture.cpp:158-159`). */
const DEFAULT_SLICES = 8;

/**
 * The slices of a sidecar that imports its image as a 3D texture. Null for no sidecar or another
 * importer, under which Godot imports no 3D texture, and for a count under 1, which Godot divides
 * by (`:372-373`).
 */
export function importSlicesOf(sidecar: ParsedImportFile | null): ImportSlices | null {
  if (sidecar?.importer !== TEXTURE_3D_IMPORTER) return null;
  const horizontal = sliceCount(sidecar.params['slices/horizontal']);
  const vertical = sliceCount(sidecar.params['slices/vertical']);
  return horizontal >= 1 && vertical >= 1 ? { horizontal, vertical } : null;
}

function sliceCount(value: string | undefined): number {
  return value === undefined ? DEFAULT_SLICES : Math.trunc(Number(value));
}
