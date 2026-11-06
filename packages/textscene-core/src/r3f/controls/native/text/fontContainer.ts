/**
 * Opens a scene font's bytes into the `SfntFile` its table readers take, whichever container holds
 * them: a plain sfnt, a WOFF or a WOFF2. A compressed container decompresses only the tables the
 * readers need, so the file opens with `head`, `hhea`, `OS/2`, `fvar`, `cmap` and `maxp` and no
 * outlines.
 */

import { openSfnt, SCENE_FONT_TABLE_TAGS, type SfntFile } from './sfntTables';
import { WOFF_SIGNATURE, lazyWoffTables } from './woffContainer';
import { WOFF2_SIGNATURE, lazyWoff2Tables } from './woff2Container';

/**
 * The tables of `bytes` that a plain sfnt, a WOFF or a WOFF2 holds under `tags`: the scalars' by
 * default. A plain sfnt opens whole. Null is bytes that no reader of this module opens.
 */
export async function openFontContainer(
  bytes: ArrayBuffer,
  tags: readonly string[] = SCENE_FONT_TABLE_TAGS
): Promise<SfntFile | null> {
  return (await lazyFontContainer(bytes, tags))();
}

/**
 * `openFontContainer` with its slow step deferred: a compressed container is prepared here, and the
 * thunk builds the tables of `tags` when first called, null for bytes that no reader opens.
 * A WOFF2 `glyf` rebuild costs 130 ms for a 6,000-glyph font, which a font that never needs it
 * should not pay at load.
 */
export async function lazyFontContainer(
  bytes: ArrayBuffer,
  tags: readonly string[]
): Promise<() => SfntFile | null> {
  if (bytes.byteLength < 4) return () => null;
  try {
    switch (new DataView(bytes).getUint32(0, false)) {
      case WOFF_SIGNATURE:
        return orNull(await lazyWoffTables(bytes, tags));
      case WOFF2_SIGNATURE:
        return orNull(await lazyWoff2Tables(bytes, tags));
      default: {
        const sfnt = openSfnt(bytes);
        return () => sfnt;
      }
    }
  } catch {
    // A container that does not decompress is a font the loader falls back from, never a throw.
    return () => null;
  }
}

function orNull(open: () => SfntFile): () => SfntFile | null {
  return () => {
    try {
      return open();
    } catch {
      return null;
    }
  };
}
