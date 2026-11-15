import { describe, expect, it } from 'vitest';
import { ByteWriter } from '../sfntOutlines.testkit';
import { sfntFileOfTables } from '../sfntTables';
import { svgBytes, svgTable } from './svg.testkit';
import type { SvgPictureDrawer } from './browserSvgPicture';
import { svgGlyphsOf } from './svgGlyphs';

const RED_GLYPH = 1;
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

function svgFace(isPpemRounded = true) {
  const documents = [{ startGlyph: RED_GLYPH, endGlyph: RED_GLYPH, bytes: svgBytes(RED_SQUARE) }];
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

/** A drawer that measures the red square's box and paints every pixel `texel`, or nothing where `texel` is null. */
function squareDrawer(texel: readonly number[] | null): SvgPictureDrawer {
  return {
    picture: () => ({
      box: { x: 0, y: -800, width: 1000, height: 1000 },
      draw: async ({ width, rows }) => {
        if (!texel) return null;
        const texels = new Uint8ClampedArray(width * rows * 4);
        for (let at = 0; at < texels.length; at += 4) texels.set(texel, at);
        return texels;
      },
    }),
  };
}

/** The bitmap of `glyph` at 16 px once its draw has landed, and how many times the glyphs told their subscribers. */
async function landed(drawer: SvgPictureDrawer | null, glyph: number) {
  const svg = (await svgGlyphsOf(svgFace(), drawer))!;
  let landings = 0;
  svg.subscribe(() => landings++);
  const read = svg.readerAt(svg.sizeAt(16));
  const first = read(glyph);
  await new Promise((resolve) => setTimeout(resolve, 0));
  return { first, bitmap: read(glyph), landings, version: svg.version };
}

/** Reads `RED_GLYPH` at `sizeCount` sizes on each landing, as a repaint of a label at each size does. */
async function repaintedSizes(sizeCount: number) {
  const svg = (await svgGlyphsOf(svgFace(), squareDrawer([255, 0, 0, 255])))!;
  const readAll = () =>
    Array.from({ length: sizeCount }, (_, i) => svg.readerAt(svg.sizeAt(10 + i))(RED_GLYPH));
  let landings = 0;
  svg.subscribe(() => {
    landings++;
    readAll();
  });
  readAll();
  const counts: number[] = [];
  for (let tick = 0; tick <= 10; tick++) {
    await new Promise((resolve) => setTimeout(resolve, 0));
    counts.push(landings);
  }
  return { bitmaps: readAll(), landingsAfter: (tick: number) => counts[tick] };
}

describe('svgGlyphsOf', () => {
  it('rounds the ascender to the nearest pixel at the whole ppem where the face rounds its ppem', async () => {
    // 800 units at 13 px are 665.6/64 px: 10 px to the nearest pixel, 11 px up.
    const size = (await svgGlyphsOf(svgFace(true), null))!.sizeAt(13);
    expect(size).toEqual({ xPpem: 13, yPpem: 13, ascender: 640, descender: -192, xScale: 54526 });
  });

  it('takes the ascender up and the descender down to whole pixels where the face does not round', async () => {
    const size = (await svgGlyphsOf(svgFace(false), null))!.sizeAt(13);
    expect(size).toMatchObject({ ascender: 704, descender: -192 });
  });

  it('draws nothing on the first read, while the browser draws the glyph', async () => {
    expect((await landed(squareDrawer([255, 0, 0, 255]), RED_GLYPH)).first).toBeNull();
  });

  it('keeps the drawn red, green, blue and alpha once the draw lands', async () => {
    const { bitmap } = await landed(squareDrawer([255, 0, 0, 255]), RED_GLYPH);
    expect([...bitmap!.texels.subarray(0, 4)]).toEqual([255, 0, 0, 255]);
  });

  it('tells its subscribers once for each bitmap that lands', async () => {
    const { landings, version } = await landed(squareDrawer([255, 0, 0, 255]), RED_GLYPH);
    expect([landings, version]).toEqual([1, 1]);
  });

  it('tells its subscribers once for the bitmaps that land together', async () => {
    const svg = (await svgGlyphsOf(svgFace(), squareDrawer([255, 0, 0, 255])))!;
    let landings = 0;
    svg.subscribe(() => landings++);
    const read = svg.readerAt(svg.sizeAt(16));
    read(RED_GLYPH);
    svg.readerAt(svg.sizeAt(20))(RED_GLYPH);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect([landings, svg.version]).toEqual([1, 2]);
  });

  it('draws every glyph of a repaint that reads nine sizes', async () => {
    const { bitmaps } = await repaintedSizes(9);
    expect(bitmaps.every((bitmap) => bitmap !== null)).toBe(true);
  });

  it('stops repainting where a repaint reads more sizes than it keeps', async () => {
    const { landingsAfter } = await repaintedSizes(70);
    expect(landingsAfter(5)).toBe(landingsAfter(10));
  });

  it('places the bitmap on the advance, raised by its height times the line over the ascender', async () => {
    const { bitmap } = await landed(squareDrawer([255, 0, 0, 255]), RED_GLYPH);
    expect(bitmap!.grid).toEqual({ left: 0, top: -13, width: 16, height: 16 });
  });

  it('draws nothing, and tells no one, where the browser draws nothing', async () => {
    const { bitmap, landings } = await landed(squareDrawer(null), RED_GLYPH);
    expect([bitmap, landings]).toEqual([null, 0]);
  });

  it('draws nothing outside a browser', async () => {
    expect((await landed(null, RED_GLYPH)).bitmap).toBeNull();
  });

  it('gives no SVG form to a glyph no document covers', async () => {
    expect((await landed(squareDrawer([255, 0, 0, 255]), PLAIN_GLYPH)).bitmap).toBeUndefined();
  });
});
