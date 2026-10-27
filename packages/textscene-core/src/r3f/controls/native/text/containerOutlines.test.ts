// @vitest-environment node
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import wawoff2 from 'wawoff2';
import { describe, expect, it } from 'vitest';
import { woffFromSfnt } from './fontContainer.testkit';
import { openFontOutlines, type SfntOutlines } from './sfntOutlines';
import { fixtureFontBytes } from './sfntOutlines.testkit';

const BUNDLED_WOFF2 = join(import.meta.dirname, '../../../../../assets/fonts/OpenSans_SemiBold.woff2');

function bytesOf(path: string): ArrayBuffer {
  const file = readFileSync(path);
  return file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength) as ArrayBuffer;
}

/** The plain TrueType font that Google's reference WOFF2 decoder makes of `woff2`: an independent decoder of the glyf transform. */
async function plainFontOf(woff2: ArrayBuffer): Promise<ArrayBuffer> {
  const plain = await wawoff2.decompress(new Uint8Array(woff2));
  return plain.buffer.slice(plain.byteOffset, plain.byteOffset + plain.byteLength) as ArrayBuffer;
}

async function outlinesOf(bytes: ArrayBuffer): Promise<SfntOutlines> {
  const outlines = await openFontOutlines(bytes);
  if (!outlines) throw new Error('expected outlines from the font');
  return outlines;
}

/** The glyphs with an outline, as `[glyph index, contours]` at `fontSizePx`. */
function allContours(outlines: SfntOutlines, glyphCount: number, fontSizePx: number) {
  return Array.from({ length: glyphCount }, (_, glyphIndex) =>
    outlines.glyphContours(glyphIndex, fontSizePx)
  );
}

describe('openFontOutlines of a .woff2 with a transformed glyf', () => {
  it('gives the outline of H that fontkit gives for the same font', async () => {
    const outlines = await outlinesOf(bytesOf(BUNDLED_WOFF2));

    // fontkit 2.0.4 on the font the reference decoder makes: H is glyph 43 and its path, in design
    // units over 2048 per em, is (1345,0) (1106,0) (1106,660) (432,660) (432,0) (192,0) (192,1462)
    // (432,1462) (432,864) (1106,864) (1106,1462) (1345,1462). At 2048 px one design unit is one px.
    const contours = outlines.glyphContours(outlines.glyphIndex(0x48), 2048)!;

    expect(outlines.glyphIndex(0x48)).toBe(43);
    expect(contours.points.map((point) => point.x)).toEqual([
      1345, 1106, 1106, 432, 432, 192, 192, 432, 432, 1106, 1106, 1345,
    ]);
    expect(contours.points.map((point) => point.y)).toEqual([
      -0, -0, -660, -660, -0, -0, -1462, -1462, -864, -864, -1462, -1462,
    ]);
  });

  it.each([16, 64])(
    'gives every glyph the contours of the reference decoder at %i px',
    async (fontSizePx) => {
      const woff2 = bytesOf(BUNDLED_WOFF2);
      const reference = (await openFontOutlines(await plainFontOf(woff2)))!;
      const rebuilt = await outlinesOf(woff2);
      const glyphCount = 1150;

      expect(allContours(rebuilt, glyphCount, fontSizePx)).toEqual(
        allContours(reference, glyphCount, fontSizePx)
      );
    }
  );

  it('maps characters as the plain font does', async () => {
    const woff2 = bytesOf(BUNDLED_WOFF2);
    const reference = (await openFontOutlines(await plainFontOf(woff2)))!;
    const rebuilt = await outlinesOf(woff2);

    const codePoints = [0x20, 0x41, 0xe9, 0x416, 0x20ac];

    expect(codePoints.map((codePoint) => rebuilt.glyphIndex(codePoint))).toEqual(
      codePoints.map((codePoint) => reference.glyphIndex(codePoint))
    );
  });

  it('answers null for a .woff2 whose compressed data is cut short', async () => {
    const whole = bytesOf(BUNDLED_WOFF2);

    expect(await openFontOutlines(whole.slice(0, whole.byteLength >> 1))).toBeNull();
  });
});

describe('openFontOutlines of a WOFF', () => {
  it.each([
    ['TrueType', 'open-sans-semibold-subset.ttf'],
    ['OpenType-CFF', 'montserrat-extra-bold.otf'],
  ])('gives a WOFF of a %s font the contours of its plain font', async (_kind, fixture) => {
    const plain = fixtureFontBytes(fixture);
    const reference = (await openFontOutlines(plain))!;
    const rebuilt = await outlinesOf(woffFromSfnt(plain, { compress: true }));
    const glyphCount = 60;

    expect(allContours(rebuilt, glyphCount, 64)).toEqual(allContours(reference, glyphCount, 64));
  });
});

describe('openFontOutlines of a plain font', () => {
  it('reads the same outlines as the synchronous reader', async () => {
    const plain = fixtureFontBytes('open-sans-semibold-subset.ttf');

    const outlines = await outlinesOf(plain);

    expect(outlines.glyphContours(outlines.glyphIndex(0x48), 64)).toEqual(
      (await openFontOutlines(plain))!.glyphContours(20, 64)
    );
  });
});
