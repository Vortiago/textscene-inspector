/**
 * The raster of a run that holds a colour glyph or a scaled glyph. Godot draws each glyph as its own
 * quad over what is under it, in mix blend: a coverage glyph in the font colour, and a colour glyph's
 * texels, which hold premultiplied colour, as if they were straight (`text_server_adv.cpp:4044-4046`).
 * The raster lays the glyphs over each other in that order, and keeps straight colour for its own
 * quad's blend.
 */
import type { BitmapGrid } from '../ftGrays';
import type { ByteColour, GlyphBitmap } from '../glyphCoverage';
import type { ColourBitmap } from './colourBitmap';

/** A factor for each colour channel, over 1 where a modulate is: a shader multiplies by it unclamped. */
export type ColourTint = readonly [red: number, green: number, blue: number];

/** The colours of a run: the font colour of a coverage glyph, and the tint of a colour glyph's texels. */
export interface RunColours {
  readonly text: ByteColour;
  readonly colourGlyphs: ColourTint;
}

/**
 * A bitmap at its glyph origin in the raster, px, drawn `scale` px a texel. A fractional origin or
 * scale samples it as a linear filter does.
 */
export interface PlacedColourBitmap {
  readonly bitmap: ColourBitmap;
  readonly originX: number;
  readonly originY: number;
  readonly scale: number;
}

/**
 * A glyph as it lands on the raster: a coverage bitmap on whole raster pixels, a colour bitmap at its
 * origin, or a coverage bitmap as a quad at its origin, its texels white with the coverage in alpha
 * as Godot's `FORMAT_LA8` texture holds them (`text_server_adv.cpp:1170-1174`), in the font colour.
 */
export type DrawnGlyph =
  | { readonly coverage: GlyphBitmap }
  | { readonly colour: PlacedColourBitmap }
  | { readonly coverageQuad: PlacedColourBitmap };

/**
 * `image` with each of `drawn` laid over it in order. The alpha of every pixel combines as
 * `blendGlyphBitmap` combines it, `a + c (1 - a)` to the level, so a pixel that only coverage glyphs
 * reach has the alpha it has in a run of them alone. A pixel no glyph reaches keeps the font colour.
 */
export function mixedGlyphRaster(
  image: ImageData,
  drawn: readonly DrawnGlyph[],
  colours: RunColours
): ImageData {
  const premultiplied = new Float32Array(image.width * image.height * 4);
  for (const glyph of drawn) {
    if ('coverage' in glyph) layCoverage(image, premultiplied, glyph.coverage, colours.text);
    else if ('colour' in glyph) layColourBitmap(image, premultiplied, glyph.colour, colours.colourGlyphs);
    else layColourBitmap(image, premultiplied, glyph.coverageQuad, byteTint(colours.text));
  }
  straightColours(image, premultiplied, colours.text);
  return image;
}

/**
 * Lays one source pixel, straight colour `red, green, blue` at alpha `level`, over the pixel at
 * `pixel`. `premultiplied` holds each pixel's colour times its alpha, and the alpha unrounded.
 */
function layPixel(
  image: ImageData,
  premultiplied: Float32Array,
  pixel: number,
  red: number,
  green: number,
  blue: number,
  level: number
): void {
  const { data } = image;
  const kept = 1 - level / 255;
  const at = pixel * 4;
  premultiplied[at] = red * (level / 255) + premultiplied[at]! * kept;
  premultiplied[at + 1] = green * (level / 255) + premultiplied[at + 1]! * kept;
  premultiplied[at + 2] = blue * (level / 255) + premultiplied[at + 2]! * kept;
  premultiplied[at + 3] = level / 255 + premultiplied[at + 3]! * kept;
  data[pixel * 4 + 3] = Math.round(level + (data[pixel * 4 + 3]! * (255 - level)) / 255);
}

/** The rows and columns of `grid` that land on `image`. */
function visibleSpan(
  image: ImageData,
  grid: BitmapGrid
): { firstRow: number; endRow: number; firstColumn: number; endColumn: number } {
  return {
    firstRow: Math.max(0, -grid.top),
    endRow: Math.min(grid.height, image.height - grid.top),
    firstColumn: Math.max(0, -grid.left),
    endColumn: Math.min(grid.width, image.width - grid.left),
  };
}

function layCoverage(
  image: ImageData,
  premultiplied: Float32Array,
  { grid, coverage }: GlyphBitmap,
  [red, green, blue]: ByteColour
): void {
  const { firstRow, endRow, firstColumn, endColumn } = visibleSpan(image, grid);
  for (let row = firstRow; row < endRow; row++) {
    for (let column = firstColumn; column < endColumn; column++) {
      const level = coverage[row * grid.width + column]!;
      if (level === 0) continue;
      const pixel = (grid.top + row) * image.width + grid.left + column;
      layPixel(image, premultiplied, pixel, red, green, blue, level);
    }
  }
}

function byteTint([red, green, blue]: ByteColour): ColourTint {
  return [red / 255, green / 255, blue / 255];
}

/**
 * Lays a bitmap, each texel tinted by `tint`, at its origin. The render target clamps each tinted
 * channel to 1 before it blends. Godot's quad spans the bitmap and a
 * margin of one empty texel on each side (`text_server_adv.cpp:1223-1225`), each `scale` px, sampled
 * at each pixel centre inside it. A whole-pixel origin at scale 1 lands each texel on one pixel.
 */
function layColourBitmap(
  image: ImageData,
  premultiplied: Float32Array,
  { bitmap, originX, originY, scale }: PlacedColourBitmap,
  tint: ColourTint
): void {
  const { left, top, width, height } = placedQuad(bitmap.grid, originX, originY, scale);
  const firstColumn = Math.max(0, Math.ceil(left - 0.5));
  const endColumn = Math.min(image.width, Math.ceil(left + width - 0.5));
  const firstRow = Math.max(0, Math.ceil(top - 0.5));
  const endRow = Math.min(image.height, Math.ceil(top + height - 0.5));
  const texel = [0, 0, 0, 0];
  for (let y = firstRow; y < endRow; y++) {
    // The texel place of the pixel centre, counted from the centre of the bitmap's first texel.
    const v = (y + 0.5 - top) / scale - GLYPH_RECT_MARGIN - 0.5;
    for (let x = firstColumn; x < endColumn; x++) {
      const u = (x + 0.5 - left) / scale - GLYPH_RECT_MARGIN - 0.5;
      sampleLinear(bitmap, u, v, texel);
      if (texel[3] === 0) continue;
      const pixel = y * image.width + x;
      layPixel(
        image,
        premultiplied,
        pixel,
        Math.min(255, texel[0]! * tint[0]),
        Math.min(255, texel[1]! * tint[1]),
        Math.min(255, texel[2]! * tint[2]),
        texel[3]!
      );
    }
  }
}

/** How many empty texels Godot's glyph rectangle reaches past the bitmap on each side (`rect_range`, `text_server_adv.h:187`). */
const GLYPH_RECT_MARGIN = 1;

/** The rectangle of the quad Godot draws for `grid` at its origin, `scale` px a texel, margin included. */
export function placedQuad(grid: BitmapGrid, originX: number, originY: number, scale: number): BitmapGrid {
  return {
    left: originX + (grid.left - GLYPH_RECT_MARGIN) * scale,
    top: originY + (grid.top - GLYPH_RECT_MARGIN) * scale,
    width: (grid.width + 2 * GLYPH_RECT_MARGIN) * scale,
    height: (grid.height + 2 * GLYPH_RECT_MARGIN) * scale,
  };
}

/**
 * The texel of `bitmap` at the texel place `(u, v)`, filtered linearly over the four texels round it.
 * A texel off the bitmap is white with no alpha, as Godot fills each glyph texture
 * (`text_server_adv.cpp:895-911`): its colour reaches an edge pixel the filter mixes it into.
 */
function sampleLinear({ grid, texels }: ColourBitmap, u: number, v: number, out: number[]): void {
  const column = Math.floor(u);
  const row = Math.floor(v);
  const fu = u - column;
  const fv = v - row;
  out.fill(0);
  addTexel(grid, texels, column, row, (1 - fu) * (1 - fv), out);
  addTexel(grid, texels, column + 1, row, fu * (1 - fv), out);
  addTexel(grid, texels, column, row + 1, (1 - fu) * fv, out);
  addTexel(grid, texels, column + 1, row + 1, fu * fv, out);
}

/** Adds the texel at `column`, `row` times `weight` to `out`, the empty texel where it is off the bitmap. */
function addTexel(
  grid: BitmapGrid,
  texels: Uint8Array,
  column: number,
  row: number,
  weight: number,
  out: number[]
): void {
  if (weight === 0) return;
  const isOnBitmap = column >= 0 && row >= 0 && column < grid.width && row < grid.height;
  const from = isOnBitmap ? texels : EMPTY_TEXEL;
  const at = isOnBitmap ? (row * grid.width + column) * 4 : 0;
  for (let channel = 0; channel < 4; channel++) out[channel] = out[channel]! + from[at + channel]! * weight;
}

/** The texel of Godot's glyph texture where no glyph lies. */
const EMPTY_TEXEL = Uint8Array.of(255, 255, 255, 0);

/** Divides each pixel's colour by its alpha, and gives a pixel no glyph reaches the font colour. */
function straightColours(image: ImageData, premultiplied: Float32Array, text: ByteColour): void {
  const { data } = image;
  for (let at = 0; at < data.length; at += 4) {
    const alpha = premultiplied[at + 3]!;
    for (let channel = 0; channel < 3; channel++) {
      data[at + channel] =
        alpha === 0 ? text[channel]! : Math.round(Math.min(255, premultiplied[at + channel]! / alpha));
    }
  }
}
