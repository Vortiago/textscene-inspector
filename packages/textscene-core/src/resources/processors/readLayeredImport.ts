import type { DependentRead } from './dependentRead';
import type { ParsedImportFile } from '../../parser/importParser';
import { readImportSidecar } from './readImportSidecar';

/** The sidecar's import, read before the image so a missing sidecar costs no decode. `noun` names it. */
export async function readLayeredImport<Import>(
  read: DependentRead,
  importOf: (sidecar: ParsedImportFile | null) => Import | null,
  noun: string
): Promise<Import> {
  const layered = importOf(await readImportSidecar(read));
  if (!layered)
    throw new Error(`${read.assetPath} has no sidecar that imports it as ${noun} with slices Godot can cut`);
  return layered;
}
