/**
 * The `cvt ` table of a TrueType font, which the hinting programs and `cvar` share. It lives apart from the
 * interpreter, so the code that reads a variable font's instance stays out of the interpreter's lazy chunk.
 *
 * Portions ported from FreeType (FreeType Project License).
 * Copyright (C) 1996-2026 by David Turner, Robert Wilhelm, and Werner Lemberg.
 * See THIRD-PARTY-NOTICES.md.
 */

import { FIXED_26_6_ONE } from '../fontMetrics';
import { tableBytes, type SfntFile } from '../sfntTables';

/** `tt_face_load_cvt`: the control values in 26.6 font units. */
export function controlValuesOf(sfnt: SfntFile): Int32Array {
  const bytes = tableBytes(sfnt, 'cvt ');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return Int32Array.from(
    { length: bytes.length >> 1 },
    (_, index) => view.getInt16(index * 2, false) * FIXED_26_6_ONE
  );
}
