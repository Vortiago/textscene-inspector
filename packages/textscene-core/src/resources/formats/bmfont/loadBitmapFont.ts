/**
 * The load of a BMFont `FontFile`: the descriptor, then each page it names, assembled into the
 * `BitmapFont` the text engine shapes and draws. A page that does not load fails the whole font, as
 * `FontFile::_load_bitmap_font` fails (`scene/resources/font.cpp:1908,1969`).
 */

import { FixedSizeScaleMode } from '../../../godot/text/textServerEnums';
import { slotInt } from '../../../godot/variant/intSlots';
import { getBaseDir, pathJoin } from '../../../godot/string/string';
import type { BitmapFill, BitmapFont } from '../../fonts/font/types';
import { stackFills } from './fillSheet';
import { decodePageFills, decodePageOutlineFills, type PageImage } from './pageFill';
import { parseDescriptor } from './parseDescriptor';

/** Reads and decodes the page image at a path. Rejects when the file is missing or does not decode. */
export type ReadPageImage = (path: string) => Promise<PageImage>;

/**
 * The scale mode of the import sidecar's `scaling_mode`, `FIXED_SIZE_SCALE_ENABLED` with no sidecar
 * (`resource_importer_bmfont.cpp:67`). The importer casts the integer, so a value past the enum is kept.
 */
function bitmapScaleMode(importParams: Record<string, string>): number {
  return (
    slotInt(importParams['scaling_mode'], FixedSizeScaleMode.FIXED_SIZE_SCALE_ENABLED) ??
    FixedSizeScaleMode.FIXED_SIZE_SCALE_ENABLED
  );
}

/** Spreads the per-page maps of fills into one array by fill index. */
function fillArrayOf(pageFills: readonly Map<number, BitmapFill>[]): (BitmapFill | undefined)[] {
  const fills: (BitmapFill | undefined)[] = [];
  for (const pageFill of pageFills) {
    for (const [index, fill] of pageFill) fills[index] = fill;
  }
  return fills;
}

export async function loadBitmapFont(
  descriptorPath: string,
  descriptorBytes: ArrayBuffer,
  readPage: ReadPageImage,
  importParams: Record<string, string>
): Promise<BitmapFont> {
  const descriptor = parseDescriptor(descriptorBytes);
  const decoded = await Promise.all(
    descriptor.pages.map(async (page) => {
      const image = await readPage(pathJoin(getBaseDir(descriptorPath), page.file));
      return { glyph: decodePageFills(page, image), outline: decodePageOutlineFills(page, image) };
    })
  );
  return {
    fixedSize: descriptor.fixedSize,
    ascent: descriptor.ascent,
    descent: descriptor.descent,
    glyphs: descriptor.glyphs,
    kerning: descriptor.kerning,
    sheet: stackFills(fillArrayOf(decoded.map((page) => page.glyph))),
    outlineSheet: stackFills(fillArrayOf(decoded.map((page) => page.outline))),
    scaleMode: bitmapScaleMode(importParams),
  };
}
