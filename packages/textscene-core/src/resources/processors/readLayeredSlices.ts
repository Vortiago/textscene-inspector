/**
 * The layer grid a layered texture's **Import sidecar** names, read before the image so a missing
 * sidecar costs no decode. Both layered processors share it.
 */

import type { DependentRead } from './dependentRead';
import type { ImportSlices } from '../../godot/import/layeredTextureImport';
import type { ParsedImportFile } from '../../parser/importParser';
import { readImportSidecar } from './readImportSidecar';

/** `slicesOf` reads the grid from the parsed sidecar. `noun` names the import in the error. */
export async function readLayeredSlices(
  read: DependentRead,
  slicesOf: (sidecar: ParsedImportFile | null) => ImportSlices | null,
  noun: string
): Promise<ImportSlices> {
  const slices = slicesOf(await readImportSidecar(read));
  if (!slices) throw new Error(`${read.assetPath} has no sidecar that imports it as ${noun}`);
  return slices;
}
