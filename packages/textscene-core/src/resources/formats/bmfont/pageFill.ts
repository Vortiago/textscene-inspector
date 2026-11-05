/**
 * The glyph fill of a BMFont page image: the texture Godot's converter leaves for the glyphs of each
 * channel layout (`FontFile::_load_bitmap_font`, `scene/resources/font.cpp:1908-1943,1893-1907`;
 * `_convert_*`, `:623-880`). The outline textures a layout may also carry are not read.
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */

import type { ImageSourceFormat } from '../../../godot/import/imageSourceFormat';
import type { BitmapFill } from '../../fonts/font/types';
import type { ImagePixels } from '../image/imagePixels';
import type { BmfontPage, PageLayout } from './parseDescriptor';

/** A decoded page: its RGBA8 pixels, top row first, and the format Godot's loader reads the file in. */
export interface PageImage {
  pixels: ImagePixels;
  source: ImageSourceFormat | null;
}

const RED = 0;
const GREEN = 1;
const BLUE = 2;
const ALPHA = 3;
const CHANNELS_PER_TEXEL = 4;

/** A white texel with `alpha`: Godot's `FORMAT_LA8` with a constant 255 luminance. */
function whiteWithAlpha(alphas: Uint8Array | number[], width: number, height: number): BitmapFill {
  const data = new Uint8Array(width * height * CHANNELS_PER_TEXEL);
  for (let texel = 0; texel < width * height; texel++) {
    data.fill(255, texel * CHANNELS_PER_TEXEL, texel * CHANNELS_PER_TEXEL + ALPHA);
    data[texel * CHANNELS_PER_TEXEL + ALPHA] = alphas[texel]!;
  }
  return { width, height, data };
}

/** The values of one channel of `image`: a greyscale page holds its grey in every channel. */
function channelOf({ pixels }: PageImage, channel: number): number[] {
  const values: number[] = [];
  for (let texel = 0; texel < pixels.width * pixels.height; texel++) {
    values.push(pixels.data[texel * CHANNELS_PER_TEXEL + channel]!);
  }
  return values;
}

/**
 * A page of one channel, white with the channel as alpha (`_convert_mono_8bit`, `_convert_mono_4bit`).
 * A greyscale page holds its grey in the red channel.
 */
function mono(
  image: PageImage,
  channel: number,
  toAlpha: (value: number) => number = (value) => value
): BitmapFill {
  const { width, height } = image.pixels;
  const values = channelOf(image, image.source === 'Lum8' ? RED : channel);
  return whiteWithAlpha(values.map(toAlpha), width, height);
}

/** `value` kept only above `threshold` (`_convert_mono_4bit`, `_convert_rgba_4bit`). */
const upperHalf = (value: number): number => (value > 0x7f ? value : 0);

/** The packed 4-bit glyph half (`_convert_packed_4bit`), a `uint8_t` store of `(value - 0x0F) * 2`. */
const packedGlyphHalf = (value: number): number => (value > 0x0f ? ((value - 0x0f) * 2) & 0xff : 0);

function rgba4(image: PageImage): BitmapFill {
  const { width, height, data } = image.pixels;
  return { width, height, data: Uint8Array.from(data, upperHalf) };
}

function colour(image: PageImage): BitmapFill {
  const { width, height, data } = image.pixels;
  return { width, height, data: Uint8Array.from(data) };
}

/** Four fills, one for each channel of a packed page, numbered from `4 * pageId`. */
function packed(
  image: PageImage,
  pageId: number,
  toAlpha: (value: number) => number
): Map<number, BitmapFill> {
  const { width, height } = image.pixels;
  return new Map(
    [RED, GREEN, BLUE, ALPHA].map((channel) => [
      pageId * 4 + channel,
      whiteWithAlpha(channelOf(image, channel).map(toAlpha), width, height),
    ])
  );
}

function unsupported(file: string): Error {
  return new Error(`Unsupported BMFont texture format in ${file}.`);
}

/** `Image::FORMAT_RGBA8` only: the layouts that read all four channels. */
const isRgba = (image: PageImage): boolean => image.source === 'RGBA8';

/** `FORMAT_RGBA8` or `FORMAT_L8`: the layouts that read one channel. */
const isRgbaOrGrey = (image: PageImage): boolean => image.source === 'RGBA8' || image.source === 'Lum8';

// Godot picks a layout by the channel settings, then refuses an image that is not in the format it reads.
function packedFills(layout: PageLayout, image: PageImage, page: BmfontPage): Map<number, BitmapFill> {
  const alphaChannel = layout.channels[ALPHA];
  if (alphaChannel === 0) {
    if (!isRgba(image)) throw unsupported(page.file);
    return packed(image, page.id, (value) => value);
  }
  if (alphaChannel === 2 && layout.outline > 0) {
    if (!isRgba(image)) throw unsupported(page.file);
    return packed(image, page.id, packedGlyphHalf);
  }
  throw unsupported(page.file);
}

/** The text loader's extra colour layout: alpha is the glyph, the three colour channels are 4 (`font.cpp:1893`). */
function isLegacyColourLayout({ channels }: PageLayout, image: PageImage): boolean {
  return (
    channels[ALPHA] === 0 &&
    channels[RED] === 4 &&
    channels[GREEN] === 4 &&
    channels[BLUE] === 4 &&
    isRgba(image)
  );
}

function unpackedFill(layout: PageLayout, image: PageImage, page: BmfontPage): BitmapFill {
  const { channels, outline } = layout;
  if (layout.format === 'text' && isLegacyColourLayout(layout, image)) return colour(image);
  if (channels.every((channel) => channel === 0)) {
    if (!isRgba(image)) throw unsupported(page.file);
    return colour(image);
  }
  if (channels.every((channel) => channel === 2) && outline > 0) {
    if (!isRgba(image)) throw unsupported(page.file);
    return rgba4(image);
  }
  if (layout.firstGlyphChannel >= 0 && layout.firstOutlineChannel >= 0 && outline > 0) {
    if (!isRgbaOrGrey(image)) throw unsupported(page.file);
    return mono(image, layout.firstGlyphChannel);
  }
  if (layout.firstCombinedChannel >= 0 && outline > 0) {
    if (!isRgbaOrGrey(image)) throw unsupported(page.file);
    return mono(image, layout.firstCombinedChannel, upperHalf);
  }
  if (layout.firstGlyphChannel >= 0) {
    if (!isRgbaOrGrey(image)) throw unsupported(page.file);
    return mono(image, layout.firstGlyphChannel);
  }
  throw unsupported(page.file);
}

/**
 * The glyph fills of `page` read from `image`, by the index a glyph's `fillIndex` names: the page's
 * own for an unpacked page, and four from `4 * page.id` for a packed one. Throws for a layout or an
 * image format Godot's loader refuses.
 */
export function decodePageFills(page: BmfontPage, image: PageImage): Map<number, BitmapFill> {
  const { layout } = page;
  if (layout.packed) return packedFills(layout, image, page);
  return new Map([[page.id, unpackedFill(layout, image, page)]]);
}
