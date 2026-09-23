import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseSfntScalars } from './sfntTables';

const CORPUS_TTF = join(
  import.meta.dirname,
  '../../../../../../../scenes/demos/2d/dodge_the_creeps/fonts/Xolonium-Regular.ttf'
);
const CORPUS_OTF = join(
  import.meta.dirname,
  '../../../../../../../scenes/demos/2d/role_playing_game/theme/fonts/montserrat_extra_bold.otf'
);
const CORPUS_WOFF2 = join(
  import.meta.dirname,
  '../../../../../../../scenes/demos/gui/bidi_and_font_features/fonts/Recursive_VF_subset-GF_latin_basic.woff2'
);

function toArrayBuffer(buf: Buffer): ArrayBuffer {
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
}

describe('parseSfntScalars', () => {
  it('reads unitsPerEm (head) and ascent/descent (hhea) from a real corpus TrueType font', () => {
    // Verified with fontkit 5.x against the same file. fontkit reports `descent` negative, and the
    // parser stores the magnitude, as `FontMetrics.descent` does.
    const bytes = toArrayBuffer(readFileSync(CORPUS_TTF));
    expect(parseSfntScalars(bytes)).toEqual({ unitsPerEm: 1000, ascent: 930, descent: 270 });
  });

  it('reads unitsPerEm/ascent/descent from a real corpus OpenType-CFF (OTTO) font', () => {
    // Verified with fontkit against the same file. It covers the 'OTTO' sfntVersion branch.
    const bytes = toArrayBuffer(readFileSync(CORPUS_OTF));
    expect(parseSfntScalars(bytes)).toEqual({ unitsPerEm: 1000, ascent: 968, descent: 251 });
  });

  it('returns null for a woff2 (Brotli-compressed, not raw SFNT tables)', () => {
    const bytes = toArrayBuffer(readFileSync(CORPUS_WOFF2));
    expect(parseSfntScalars(bytes)).toBeNull();
  });

  it('returns null for bytes too short to hold an SFNT header', () => {
    expect(parseSfntScalars(new ArrayBuffer(4))).toBeNull();
  });

  it('returns null for a recognisable non-font signature (e.g. a PNG)', () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
    expect(parseSfntScalars(png.buffer)).toBeNull();
  });

  it('returns null when the table directory claims a table past the end of the buffer (truncated/corrupt file)', () => {
    // A minimal, well-formed SFNT header (TrueType version, 1 table) whose
    // ONE table record claims an offset/length that overruns the buffer.
    const buf = new ArrayBuffer(12 + 16);
    const dv = new DataView(buf);
    dv.setUint32(0, 0x00010000, false); // sfntVersion
    dv.setUint16(4, 1, false); // numTables
    dv.setUint16(6, 0, false); // searchRange
    dv.setUint16(8, 0, false); // entrySelector
    dv.setUint16(10, 0, false); // rangeShift
    dv.setUint8(12, 'h'.charCodeAt(0));
    dv.setUint8(13, 'e'.charCodeAt(0));
    dv.setUint8(14, 'a'.charCodeAt(0));
    dv.setUint8(15, 'd'.charCodeAt(0));
    dv.setUint32(16, 0, false); // checksum
    dv.setUint32(20, 1_000_000, false); // offset, past the buffer
    dv.setUint32(24, 54, false); // length
    expect(parseSfntScalars(buf)).toBeNull();
  });
});
