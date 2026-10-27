/**
 * Opens a scene font's bytes into the `SfntFile` its table readers take, whichever container holds
 * them: a plain sfnt, a WOFF or a WOFF2. A compressed container decompresses only the tables the
 * readers need, so the file opens with `head`, `hhea`, `OS/2` and `fvar` and no outlines.
 */

import { openSfnt, type SfntFile } from './sfntTables';
import { WOFF_SIGNATURE, readWoffTables } from './woffContainer';
import { WOFF2_SIGNATURE, readWoff2Tables } from './woff2Container';

/** Null is bytes that no reader of this module opens. */
export async function openFontContainer(bytes: ArrayBuffer): Promise<SfntFile | null> {
  if (bytes.byteLength < 4) return null;
  try {
    switch (new DataView(bytes).getUint32(0, false)) {
      case WOFF_SIGNATURE:
        return await readWoffTables(bytes);
      case WOFF2_SIGNATURE:
        return await readWoff2Tables(bytes);
      default:
        return openSfnt(bytes);
    }
  } catch {
    // A container that does not decompress is a font the loader falls back from, never a throw.
    return null;
  }
}
