/** The RSCC fixtures `compressed/generate.gd` writes, one ArrayMesh saved in each mode. */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export type CompressedFixture = 'mesh' | 'mesh_zstd' | 'mesh_fastlz' | 'mesh_deflate' | 'mesh_gzip';

/** The file as a standalone ArrayBuffer, since a Node Buffer is a view into a shared pool. */
export function compressedFixture(name: CompressedFixture): ArrayBuffer {
  return new Uint8Array(readFileSync(join(import.meta.dirname, 'compressed', `${name}.res`))).buffer;
}
