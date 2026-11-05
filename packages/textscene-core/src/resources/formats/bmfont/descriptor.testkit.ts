/**
 * One small BMFont in both descriptor formats: a 16 px font with `H`, `i`, a half-alpha `A`, a red
 * `V` and a space on one RGBA page, and the kerning pair `A V` of -3.
 */

import { ByteWriter } from '../binaryresource/testing/binaryResourceBytes';

/** The glyphs as `[id, x, y, width, height, xoffset, yoffset, xadvance]`. */
const GLYPH_ROWS = [
  [32, 0, 0, 0, 0, 0, 0, 5],
  [72, 0, 0, 8, 12, 1, 4, 10],
  [105, 8, 0, 2, 12, 1, 4, 4],
  [65, 16, 0, 8, 12, 0, 4, 9],
  [86, 24, 0, 8, 12, 0, 4, 9],
] as const;

const charLine = ([id, x, y, width, height, xoffset, yoffset, xadvance]: (typeof GLYPH_ROWS)[number]) =>
  `char id=${id} x=${x} y=${y} width=${width} height=${height} xoffset=${xoffset} yoffset=${yoffset} xadvance=${xadvance} page=0 chnl=15`;

export const TEXT_DESCRIPTOR = [
  'info face="Test" size=16 bold=0 italic=0 charset="" unicode=1 stretchH=100 smooth=0 aa=1 padding=0,0,0,0 spacing=0,0 outline=0',
  'common lineHeight=20 base=16 scaleW=64 scaleH=32 pages=1 packed=0 alphaChnl=0 redChnl=0 greenChnl=0 blueChnl=0',
  'page id=0 file="bmfont.png"',
  `chars count=${GLYPH_ROWS.length}`,
  ...GLYPH_ROWS.map(charLine),
  'kernings count=1',
  'kerning first=65 second=86 amount=-3',
  '',
].join('\n');

const utf8 = (text: string): Uint8Array => new TextEncoder().encode(text);

function block(type: number, body: ByteWriter): Uint8Array {
  return new ByteWriter().u8(type).u32(body.length).raw(body.bytes()).bytes();
}

/** The `common` settings that decide how a page image is read: red, green, blue and alpha channel values. */
interface PageSettings {
  packed?: boolean;
  channels?: readonly [number, number, number, number];
}

/** `TEXT_DESCRIPTOR` as a binary BMFont, version 3. */
export function binaryDescriptor({
  packed = false,
  channels = [0, 0, 0, 0],
}: PageSettings = {}): ArrayBuffer {
  const info = new ByteWriter()
    .u16(16)
    .u8(1 << 6)
    .u8(0)
    .u16(100)
    .u8(1)
    .u32(0)
    .u16(0)
    .u8(0)
    .raw(utf8('Test'))
    .u8(0);
  const common = new ByteWriter()
    .u16(20)
    .u16(16)
    .u16(64)
    .u16(32)
    .u16(1)
    .u8(packed ? 1 : 0)
    .u8(channels[3])
    .u8(channels[0])
    .u8(channels[1])
    .u8(channels[2]);
  const pages = new ByteWriter().raw(utf8('bmfont.png')).u8(0);
  const chars = new ByteWriter();
  for (const [id, x, y, width, height, xoffset, yoffset, xadvance] of GLYPH_ROWS) {
    chars.u32(id).u16(x).u16(y).u16(width).u16(height).u16(xoffset).u16(yoffset).u16(xadvance).u8(0).u8(15);
  }
  const kerning = new ByteWriter().u32(65).u32(86).u16(-3);
  const bytes = [
    ...new ByteWriter().raw(utf8('BMF')).u8(3).bytes(),
    ...block(1, info),
    ...block(2, common),
    ...block(3, pages),
    ...block(4, chars),
    ...block(5, kerning),
  ];
  return new Uint8Array(bytes).buffer;
}

/** `TEXT_DESCRIPTOR` with other page settings, to read a page image under another channel layout. */
export function textDescriptor({
  packed = false,
  channels = [0, 0, 0, 0],
  outline = 0,
}: PageSettings & { outline?: number } = {}): string {
  const [red, green, blue, alpha] = channels;
  return TEXT_DESCRIPTOR.replace(/outline=0/, `outline=${outline}`).replace(
    /packed=0 alphaChnl=0 redChnl=0 greenChnl=0 blueChnl=0/,
    `packed=${packed ? 1 : 0} alphaChnl=${alpha} redChnl=${red} greenChnl=${green} blueChnl=${blue}`
  );
}
