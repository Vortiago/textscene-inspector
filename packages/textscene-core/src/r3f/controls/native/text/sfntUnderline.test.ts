/** The underline FreeType gives a face, as `sfnt_load_face` reads it from `post` (`sfobjs.c:1421-1426`). */
import { describe, expect, it } from 'vitest';
import { readSfntUnderline } from './sfntUnderline';
import { sfntFileOfTables } from './sfntTables';
import { fixtureFontBytes, fixtureSfnt } from './sfntOutlines.testkit';
import { openFontContainer } from './fontContainer';

/** A `post` table of `length` bytes holding only the underline position and thickness. */
function postTable(position: number, thickness: number, length = 32): Uint8Array {
  const table = new Uint8Array(length);
  const dv = new DataView(table.buffer);
  if (length >= 12) {
    dv.setInt16(8, position, false);
    dv.setInt16(10, thickness, false);
  }
  return table;
}

const OUTLINES = ['glyf', new Uint8Array(4)] as const;
const COLOUR_STRIKES = [
  ['CBLC', new Uint8Array(4)],
  ['CBDT', new Uint8Array(4)],
] as const;

function underlineOf(...tables: (readonly [string, Uint8Array])[]) {
  return readSfntUnderline(sfntFileOfTables(new Map(tables)));
}

describe('readSfntUnderline', () => {
  it('moves the position from the top of the stroke to its centre (Cascadia Code: -200, 100)', () => {
    expect(readSfntUnderline(fixtureSfnt('cascadia-code-subset.ttf'))).toEqual({
      underlinePosition: -250,
      underlineThickness: 100,
    });
  });

  it('reads the underline of a CFF font (Montserrat ExtraBold: -75, 50)', () => {
    expect(readSfntUnderline(fixtureSfnt('montserrat-extra-bold.otf'))).toEqual({
      underlinePosition: -100,
      underlineThickness: 50,
    });
  });

  it('reads the underline of a WOFF2, whose post the container decompresses', async () => {
    const sfnt = await openFontContainer(fixtureFontBytes('open-sans-semibold-subset-hmtx.woff2'));
    expect(readSfntUnderline(sfnt!)).toEqual({ underlinePosition: -125, underlineThickness: 50 });
  });

  it('halves an odd thickness toward zero, as the C division of FT_Short does (edge case)', () => {
    expect(underlineOf(OUTLINES, ['post', postTable(-103, 193)])).toEqual({
      underlinePosition: -199,
      underlineThickness: 193,
    });
  });

  it('gives no underline to a font with no post table (error path)', () => {
    expect(underlineOf(OUTLINES)).toEqual({ underlinePosition: 0, underlineThickness: 0 });
  });

  it('gives no underline to a post table shorter than the 32 bytes FreeType reads (error path)', () => {
    expect(underlineOf(OUTLINES, ['post', postTable(-100, 50, 31)])).toEqual({
      underlinePosition: 0,
      underlineThickness: 0,
    });
  });

  it('gives no underline to a face of bitmap strikes only, which FreeType does not scale (edge case)', () => {
    expect(underlineOf(...COLOUR_STRIKES, ['post', postTable(-100, 50)])).toEqual({
      underlinePosition: 0,
      underlineThickness: 0,
    });
  });

  it('reads the underline of an sbix face over outlines (edge case)', () => {
    expect(underlineOf(OUTLINES, ['sbix', new Uint8Array(4)], ['post', postTable(-100, 50)])).toEqual({
      underlinePosition: -125,
      underlineThickness: 50,
    });
  });

  it('gives no underline to an sbix face with no outlines (edge case)', () => {
    expect(underlineOf(['sbix', new Uint8Array(4)], ['post', postTable(-100, 50)])).toEqual({
      underlinePosition: 0,
      underlineThickness: 0,
    });
  });

  it('gives no underline to colour strikes over outlines, as FreeType ignores the outlines (edge case)', () => {
    expect(underlineOf(OUTLINES, ...COLOUR_STRIKES, ['post', postTable(-100, 50)])).toEqual({
      underlinePosition: 0,
      underlineThickness: 0,
    });
  });

  it('reads the underline of a face of no outlines and no strikes, which FreeType scales (edge case)', () => {
    expect(underlineOf(['post', postTable(-100, 50)])).toEqual({
      underlinePosition: -125,
      underlineThickness: 50,
    });
  });
});
