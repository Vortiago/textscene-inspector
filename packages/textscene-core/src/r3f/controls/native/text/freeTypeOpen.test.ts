/** Which font files FreeType opens as a face, as `FT_Open_Face` decides when Godot loads a `FontFile`. */
import { describe, expect, it } from 'vitest';
import { woffFromSfnt } from './fontContainer.testkit';
import { freeTypeOpensFace } from './freeTypeOpen';
import { fixtureFontBytes } from './sfntOutlines.testkit';

const TRUETYPE = 'montserrat-semibold-subset.ttf';

/** A copy of the fixture `name`, with `edit` applied to its bytes. */
function editedFont(name: string, edit: (dv: DataView) => void): ArrayBuffer {
  const bytes = fixtureFontBytes(name).slice(0);
  edit(new DataView(bytes));
  return bytes;
}

/** The byte offset of the table record of `tag` in a plain sfnt's directory. */
function recordOf(dv: DataView, tag: string): number {
  const numTables = dv.getUint16(4, false);
  for (let i = 0; i < numTables; i++) {
    const at = 12 + i * 16;
    const found = String.fromCharCode(...[0, 1, 2, 3].map((k) => dv.getUint8(at + k)));
    if (found === tag) return at;
  }
  throw new Error(`expected a ${tag} table record, got none`);
}

/** Renames the table `tag`, so FreeType finds no table of that name. */
function withoutTable(tag: string, name = TRUETYPE): ArrayBuffer {
  return editedFont(name, (dv) => {
    const at = recordOf(dv, tag);
    for (let k = 0; k < 4; k++) dv.setUint8(at + k, 'zzzz'.charCodeAt(k));
  });
}

/** Sets the length that the record of `tag` declares. */
function withTableLength(tag: string, length: number): ArrayBuffer {
  return editedFont(TRUETYPE, (dv) => dv.setUint32(recordOf(dv, tag) + 12, length, false));
}

function withUnitsPerEm(unitsPerEm: number): ArrayBuffer {
  return editedFont(TRUETYPE, (dv) =>
    dv.setUint16(dv.getUint32(recordOf(dv, 'head') + 8, false) + 18, unitsPerEm, false)
  );
}

function withFormatTag(tag: number, name = TRUETYPE): ArrayBuffer {
  return editedFont(name, (dv) => dv.setUint32(0, tag, false));
}

function asciiBytes(text: string): ArrayBuffer {
  return new TextEncoder().encode(text).buffer as ArrayBuffer;
}

/** 4 KB of bytes from a fixed seed, so a run never starts by chance with a signature a driver reads. */
function noiseBytes(): ArrayBuffer {
  const bytes = new Uint8Array(4096);
  let seed = 0x2545f491;
  for (let i = 0; i < bytes.length; i++) {
    seed = (seed * 1103515245 + 12345) >>> 0;
    bytes[i] = (seed >>> 16) & 0xff;
  }
  bytes[0] = 0x42;
  return bytes.buffer;
}

describe('freeTypeOpensFace of an sfnt', () => {
  it('opens a TrueType font', async () => {
    expect(await freeTypeOpensFace(fixtureFontBytes(TRUETYPE))).toBe(true);
  });

  it('opens an OpenType font with CFF outlines', async () => {
    expect(await freeTypeOpensFace(fixtureFontBytes('montserrat-extra-bold.otf'))).toBe(true);
  });

  it('opens a WOFF and a WOFF2', async () => {
    const woff = woffFromSfnt(fixtureFontBytes(TRUETYPE), { compress: true });
    expect(await freeTypeOpensFace(woff)).toBe(true);
    expect(await freeTypeOpensFace(fixtureFontBytes('recursive-vf-subset.woff2'))).toBe(true);
  });

  it('does not open bytes that no driver reads (error path)', async () => {
    expect(await freeTypeOpensFace(noiseBytes())).toBe(false);
  });

  it('does not open a font cut short before its tables (error path)', async () => {
    expect(await freeTypeOpensFace(fixtureFontBytes(TRUETYPE).slice(0, 4000))).toBe(false);
  });

  it('does not open a font cut short inside its table directory (error path)', async () => {
    expect(await freeTypeOpensFace(fixtureFontBytes(TRUETYPE).slice(0, 40))).toBe(false);
  });

  it('does not open a WOFF whose tables do not decompress (error path)', async () => {
    const woff = woffFromSfnt(fixtureFontBytes(TRUETYPE), { compress: true });
    expect(await freeTypeOpensFace(woff.slice(0, 200))).toBe(false);
  });

  it('does not open a font with no head table (error path)', async () => {
    expect(await freeTypeOpensFace(withoutTable('head'))).toBe(false);
  });

  it('does not open a font whose head table is shorter than 54 bytes (error path)', async () => {
    expect(await freeTypeOpensFace(withTableLength('head', 0x35))).toBe(false);
  });

  it('opens a font of 16 and of 16384 units per em, and no font outside them (edge case)', async () => {
    expect(await freeTypeOpensFace(withUnitsPerEm(16))).toBe(true);
    expect(await freeTypeOpensFace(withUnitsPerEm(16384))).toBe(true);
    expect(await freeTypeOpensFace(withUnitsPerEm(15))).toBe(false);
    expect(await freeTypeOpensFace(withUnitsPerEm(16385))).toBe(false);
  });

  it('does not open a font with no hhea table (error path)', async () => {
    expect(await freeTypeOpensFace(withoutTable('hhea'))).toBe(false);
  });

  it('opens a Mac font tagged true with no hhea table (edge case)', async () => {
    const bytes = withoutTable('hhea');
    new DataView(bytes).setUint32(0, 0x74727565, false);
    expect(await freeTypeOpensFace(bytes)).toBe(true);
  });

  it('does not open a font with an hhea table and no hmtx table (error path)', async () => {
    expect(await freeTypeOpensFace(withoutTable('hmtx'))).toBe(false);
  });

  it('opens a font whose hmtx runs past the file, which FreeType clips (edge case)', async () => {
    expect(await freeTypeOpensFace(withTableLength('hmtx', 0x7fffffff))).toBe(true);
  });

  it('opens a font that skips a table past the file, as FreeType ignores it (edge case)', async () => {
    expect(await freeTypeOpensFace(withTableLength('GPOS', 0x7fffffff))).toBe(true);
  });

  it('does not open a font of an unknown format tag (error path)', async () => {
    expect(await freeTypeOpensFace(withFormatTag(0x12345678))).toBe(false);
  });

  it('does not open a collection of no fonts (error path)', async () => {
    const collection = new Uint8Array(16);
    collection.set([0x74, 0x74, 0x63, 0x66, 0, 1, 0, 0, 0, 0, 0, 0]);
    expect(await freeTypeOpensFace(collection.buffer)).toBe(false);
  });
});

describe('freeTypeOpensFace of a font another FreeType driver reads', () => {
  it.each([
    ['a Type 1 font', '%!PS-AdobeFont-1.0: Test 001.000\n'],
    ['a Type 1 font of the FontType1 header', '%!FontType1-1.0: Test\n'],
    ['a CID-keyed font', '%!PS-Adobe-3.0 Resource-CIDFont\n'],
    ['a Type 42 font', '%!PS-TrueTypeFont-1.0-1.0\n'],
    ['a BDF font', 'STARTFONT 2.1\nFONT test\n'],
    ['a PFR font', 'PFR0\0\0\0\0'],
  ])('opens %s by the header its driver reads', async (_kind, header) => {
    expect(await freeTypeOpensFace(asciiBytes(header))).toBe(true);
  });

  it('opens a Type 1 font in a PFB segment', async () => {
    const pfb = new Uint8Array([
      0x80,
      0x01,
      0x20,
      0,
      0,
      0,
      ...new TextEncoder().encode('%!PS-AdobeFont-1.0'),
    ]);
    expect(await freeTypeOpensFace(pfb.buffer)).toBe(true);
  });

  it('opens a PCF font, and one compressed with gzip', async () => {
    expect(await freeTypeOpensFace(new Uint8Array([0x01, 0x66, 0x63, 0x70, 0, 0, 0, 0]).buffer)).toBe(true);
    expect(await freeTypeOpensFace(new Uint8Array([0x1f, 0x8b, 0x08, 0, 0, 0, 0, 0]).buffer)).toBe(true);
  });

  it('opens a Windows font resource', async () => {
    expect(await freeTypeOpensFace(asciiBytes('MZ\x90\0\x03\0\0\0'))).toBe(true);
  });

  it('opens a bare CFF font', async () => {
    expect(await freeTypeOpensFace(new Uint8Array([1, 0, 4, 2, 0, 1, 1, 1]).buffer)).toBe(true);
  });
});
