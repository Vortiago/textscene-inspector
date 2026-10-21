/** The RSCC fixtures `compressed/generate.gd` writes, one ArrayMesh saved in each mode. */

import { join } from 'node:path';
import { fileBytes } from '../../../testing/fileBytes';

export type CompressedFixture = 'mesh' | 'mesh_zstd' | 'mesh_fastlz' | 'mesh_deflate' | 'mesh_gzip';

export function compressedFixture(name: CompressedFixture): ArrayBuffer {
  return fileBytes(join(import.meta.dirname, 'compressed', `${name}.res`));
}
