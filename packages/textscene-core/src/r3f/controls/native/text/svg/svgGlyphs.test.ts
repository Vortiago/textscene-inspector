import { describe, expect, it } from 'vitest';
import { ByteWriter } from '../sfntOutlines.testkit';
import { sfntFileOfTables } from '../sfntTables';
import { svgBytes, svgTable } from './svg.testkit';
import { svgGlyphsOf } from './svgGlyphs';

const RED_GLYPH = 1;
const EMPTY_GLYPH = 2;
const PLAIN_GLYPH = 3;

/** `head` of a 1000-unit face, with `TT_HEAD_FLAG_INTEGER_PPEM` where `isPpemRounded`. */
function headTable(isPpemRounded: boolean): Uint8Array {
  const head = new ByteWriter().u32(0x00010000).u32(0).u32(0).u32(0x5f0f3cf5);
  head
    .u16(isPpemRounded ? 0x8 : 0)
    .u16(1000)
    .raw(new Array<number>(34).fill(0));
  return new Uint8Array(head.toBytes());
}

/** `hhea` with an ascender of 800 and a descender of -200, and one long metric. */
function hheaTable(): Uint8Array {
  const hhea = new ByteWriter()
    .u32(0x00010000)
    .u16(800)
    .u16(-200 & 0xffff);
  hhea.raw(new Array<number>(26).fill(0)).u16(1);
  return new Uint8Array(hhea.toBytes());
}

/** Every glyph advances 1000 units. */
const HMTX = new Uint8Array(new ByteWriter().u16(1000).u16(0).toBytes());

const RED_SQUARE = `<svg xmlns="http://www.w3.org/2000/svg"><rect id="glyph${RED_GLYPH}" x="0" y="-800" width="1000" height="1000" fill="#ff0000"/></svg>`;
const NO_SHAPE = `<svg xmlns="http://www.w3.org/2000/svg"><g id="glyph${EMPTY_GLYPH}"/></svg>`;

function svgFace(isPpemRounded = true) {
  const documents = [
    { startGlyph: RED_GLYPH, endGlyph: RED_GLYPH, bytes: svgBytes(RED_SQUARE) },
    { startGlyph: EMPTY_GLYPH, endGlyph: EMPTY_GLYPH, bytes: svgBytes(NO_SHAPE) },
  ];
  return sfntFileOfTables(
    new Map([
      ['head', headTable(isPpemRounded)],
      ['hhea', hheaTable()],
      ['hmtx', HMTX],
      ['glyf', new Uint8Array(4)],
      ['SVG ', svgTable(documents)],
    ])
  );
}

describe('svgGlyphsOf', () => {
  it('rounds the ascender to the nearest pixel at the whole ppem where the face rounds its ppem', async () => {
    // 800 units at 13 px are 665.6/64 px: 10 px to the nearest pixel, 11 px up.
    const size = (await svgGlyphsOf(svgFace(true)))!.sizeAt(13);
    expect(size).toEqual({ xPpem: 13, yPpem: 13, ascender: 640, descender: -192, xScale: 54526 });
  });

  it('takes the ascender up and the descender down to whole pixels where the face does not round', async () => {
    const size = (await svgGlyphsOf(svgFace(false)))!.sizeAt(13);
    expect(size).toMatchObject({ ascender: 704, descender: -192 });
  });

  it('copies the bitmap as red, green, blue and alpha', async () => {
    const svg = (await svgGlyphsOf(svgFace()))!;
    const bitmap = svg.readerAt(svg.sizeAt(16))(RED_GLYPH)!;
    expect([...bitmap.texels.subarray(0, 4)]).toEqual([255, 0, 0, 255]);
  });

  it('places the bitmap on the advance, raised by its height times the line over the ascender', async () => {
    const svg = (await svgGlyphsOf(svgFace()))!;
    expect(svg.readerAt(svg.sizeAt(16))(RED_GLYPH)!.grid).toEqual({
      left: 0,
      top: -13,
      width: 16,
      height: 16,
    });
  });

  it('draws one clear pixel for a document with no shape, which ThorVG sizes 1 unit by 1', async () => {
    const svg = (await svgGlyphsOf(svgFace()))!;
    const bitmap = svg.readerAt(svg.sizeAt(16))(EMPTY_GLYPH)!;
    expect([bitmap.grid.width, bitmap.grid.height, bitmap.texels[3]]).toEqual([1, 1, 0]);
  });

  it('gives no SVG form to a glyph no document covers', async () => {
    const svg = (await svgGlyphsOf(svgFace()))!;
    expect(svg.readerAt(svg.sizeAt(16))(PLAIN_GLYPH)).toBeUndefined();
  });
});
