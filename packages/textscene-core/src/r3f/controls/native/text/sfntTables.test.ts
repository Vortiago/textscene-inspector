import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { openSfnt, parseSfntScalars, readAxisDefaults, sfntFileOfTables } from './sfntTables';

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

function scalarsOf(bytes: ArrayBuffer) {
  const sfnt = openSfnt(bytes);
  return sfnt && parseSfntScalars(sfnt);
}

describe('parseSfntScalars', () => {
  it('reads unitsPerEm (head) and ascent/descent (hhea) from a real corpus TrueType font', () => {
    // Verified with fontkit 5.x against the same file. fontkit reports `descent` negative, and the
    // parser stores the magnitude, as `FontMetrics.descent` does.
    const bytes = toArrayBuffer(readFileSync(CORPUS_TTF));
    expect(scalarsOf(bytes)).toEqual({ unitsPerEm: 1000, ascent: 930, descent: 270 });
  });

  it('reads unitsPerEm/ascent/descent from a real corpus OpenType-CFF (OTTO) font', () => {
    // Verified with fontkit against the same file. It covers the 'OTTO' sfntVersion branch.
    const bytes = toArrayBuffer(readFileSync(CORPUS_OTF));
    expect(scalarsOf(bytes)).toEqual({ unitsPerEm: 1000, ascent: 968, descent: 251 });
  });

  it('returns null for bytes too short to hold an SFNT header', () => {
    expect(scalarsOf(new ArrayBuffer(4))).toBeNull();
  });

  it('returns null for a recognisable non-font signature (e.g. a PNG)', () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
    expect(scalarsOf(png.buffer)).toBeNull();
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
    expect(scalarsOf(buf)).toBeNull();
  });
});

/** A `head` table of 54 bytes holding only `unitsPerEm`. */
function headTable(unitsPerEm: number): Uint8Array {
  const table = new Uint8Array(54);
  new DataView(table.buffer).setUint16(18, unitsPerEm, false);
  return table;
}

/** A `hhea` table of 36 bytes holding only the ascender and descender. */
function hheaTable(ascender: number, descender: number): Uint8Array {
  const table = new Uint8Array(36);
  const dv = new DataView(table.buffer);
  dv.setInt16(4, ascender, false);
  dv.setInt16(6, descender, false);
  return table;
}

const USE_TYPO_METRICS = 1 << 7;

/** An `OS/2` table of 78 bytes holding the fields that choose a font's vertical metrics. */
function os2Table(fields: {
  fsSelection?: number;
  typoAscender?: number;
  typoDescender?: number;
  winAscent?: number;
  winDescent?: number;
}): Uint8Array {
  const table = new Uint8Array(78);
  const dv = new DataView(table.buffer);
  dv.setUint16(62, fields.fsSelection ?? 0, false);
  dv.setInt16(68, fields.typoAscender ?? 0, false);
  dv.setInt16(70, fields.typoDescender ?? 0, false);
  dv.setUint16(74, fields.winAscent ?? 0, false);
  dv.setUint16(76, fields.winDescent ?? 0, false);
  return table;
}

function scalarsOfTables(hhea: [number, number], os2?: Uint8Array) {
  const tables = new Map([
    ['head', headTable(1000)],
    ['hhea', hheaTable(...hhea)],
  ]);
  if (os2) tables.set('OS/2', os2);
  return parseSfntScalars(sfntFileOfTables(tables));
}

/** FreeType's rule, `sfobjs.c:1372-1403` of the pinned Godot's FreeType: typo metrics, then hhea, then typo, then win. */
describe('parseSfntScalars vertical metrics', () => {
  it('takes the typographic metrics of a font that sets USE_TYPO_METRICS, whatever its hhea says', () => {
    const os2 = os2Table({ fsSelection: USE_TYPO_METRICS, typoAscender: 800, typoDescender: -200 });

    expect(scalarsOfTables([1300, -600], os2)).toEqual({ unitsPerEm: 1000, ascent: 800, descent: 200 });
  });

  it('takes the hhea metrics of a font that leaves USE_TYPO_METRICS clear', () => {
    const os2 = os2Table({ typoAscender: 800, typoDescender: -200 });

    expect(scalarsOfTables([1300, -600], os2)).toEqual({ unitsPerEm: 1000, ascent: 1300, descent: 600 });
  });

  it('takes the hhea metrics of a font with no OS/2 table', () => {
    expect(scalarsOfTables([930, -270])).toEqual({ unitsPerEm: 1000, ascent: 930, descent: 270 });
  });

  it('falls back to the typographic metrics when hhea holds zero', () => {
    const os2 = os2Table({ typoAscender: 790, typoDescender: -210, winAscent: 930, winDescent: 270 });

    expect(scalarsOfTables([0, 0], os2)).toEqual({ unitsPerEm: 1000, ascent: 790, descent: 210 });
  });

  it('falls back to the Windows metrics when hhea and the typographic metrics hold zero', () => {
    const os2 = os2Table({ winAscent: 930, winDescent: 270 });

    expect(scalarsOfTables([0, 0], os2)).toEqual({ unitsPerEm: 1000, ascent: 930, descent: 270 });
  });

  it('ignores an OS/2 table too short to hold its metrics', () => {
    const os2 = os2Table({ fsSelection: USE_TYPO_METRICS, typoAscender: 800, typoDescender: -200 }).slice(
      0,
      64
    );

    expect(scalarsOfTables([1300, -600], os2)).toEqual({ unitsPerEm: 1000, ascent: 1300, descent: 600 });
  });
});

describe('openSfnt', () => {
  it('opens the bytes of a font file once, for every reader of its tables', () => {
    const bytes = toArrayBuffer(readFileSync(CORPUS_TTF));

    expect(openSfnt(bytes)).toBe(openSfnt(bytes));
  });

  it('answers null again for bytes that are no plain SFNT', () => {
    const bytes = toArrayBuffer(readFileSync(CORPUS_WOFF2));

    expect([openSfnt(bytes), openSfnt(bytes)]).toEqual([null, null]);
  });
});

/** An `fvar` table: header, then one 20-byte axis record per `[tag, default]`, each default a 16.16 fixed value. */
function fvarTable(axes: readonly (readonly [string, number])[], axisCount = axes.length): Uint8Array {
  const table = new Uint8Array(16 + axes.length * 20);
  const dv = new DataView(table.buffer);
  dv.setUint16(4, 16, false); // axesArrayOffset
  dv.setUint16(8, axisCount, false);
  dv.setUint16(10, 20, false); // axisSize
  axes.forEach(([tag, value], index) => {
    const at = 16 + index * 20;
    table.set(new TextEncoder().encode(tag), at);
    dv.setInt32(at + 8, Math.round(value * 65536), false);
  });
  return table;
}

describe('readAxisDefaults', () => {
  it('reads each axis default by its tag, a 16.16 fixed value', () => {
    const sfnt = sfntFileOfTables(
      new Map([
        [
          'fvar',
          fvarTable([
            ['wght', 372.5],
            ['wdth', 87.25],
            ['slnt', -10],
          ]),
        ],
      ])
    );

    expect(readAxisDefaults(sfnt)).toEqual({ wght: 372.5, wdth: 87.25, slnt: -10 });
  });

  it('answers no axes for a font with no fvar', () => {
    expect(readAxisDefaults(sfntFileOfTables(new Map()))).toEqual({});
  });

  it('answers no axes when the axis count runs past the table', () => {
    const sfnt = sfntFileOfTables(new Map([['fvar', fvarTable([['wght', 400]], 9)]]));

    expect(readAxisDefaults(sfnt)).toEqual({});
  });
});
