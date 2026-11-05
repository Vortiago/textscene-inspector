/**
 * The BMFont painter's geometry: every glyph with ink as a quad over its page image, as
 * `font_draw_glyph` draws a bitmap glyph (`modules/text_server_adv/text_server_adv.cpp:4072-4108`).
 * The page fills of a font stack into one sheet, so a run is one mesh and one draw. Geometry is in
 * Godot pixels with Y negated once per vertex into three's Y-up space, as `glyphQuads.ts` does.
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */

import * as THREE from 'three';
import type { BitmapFill, BitmapFont } from '../../../../resources/fonts/font/types';
import { bitmapScale } from './bitmapFontMetrics';
import type { TextLayoutResult } from './textLayout';
import { perObject } from '../../../../utils/perObject';

/** The page fills of a font stacked into one RGBA8 sheet, top row first. */
export interface FillSheet {
  width: number;
  height: number;
  data: Uint8Array;
  /** The sheet row each fill starts at, by fill index; undefined for an index no page filled. */
  rowOffsets: readonly (number | undefined)[];
}

/** `fills` stacked in index order into a sheet as wide as the widest fill. */
function stackFills(fills: readonly (BitmapFill | undefined)[]): FillSheet {
  // Array.from, not map: `fills` is sparse when a page id skips an index, and map keeps the holes,
  // which spread into Math.max as undefined and give NaN.
  const width = Math.max(1, ...Array.from(fills, (fill) => fill?.width ?? 0));
  const rowOffsets: (number | undefined)[] = [];
  let height = 0;
  for (const fill of fills) {
    rowOffsets.push(fill ? height : undefined);
    height += fill?.height ?? 0;
  }
  const data = new Uint8Array(width * Math.max(1, height) * 4);
  fills.forEach((fill, index) => {
    if (!fill) return;
    for (let row = 0; row < fill.height; row++) {
      const from = row * fill.width * 4;
      data.set(fill.data.subarray(from, from + fill.width * 4), (rowOffsets[index]! + row) * width * 4);
    }
  });
  return { width, height: Math.max(1, height), data, rowOffsets };
}

/** One sheet for each font, since a font's fills never change after the load. */
export const sheetOf = perObject((bitmap: BitmapFont): FillSheet => stackFills(bitmap.fills));

/** A texture of the sheet, one for each run so that its filter state is the run's own. The bytes are shared. */
export function createSheetTexture(sheet: FillSheet): THREE.DataTexture {
  const texture = new THREE.DataTexture(sheet.data, sheet.width, sheet.height, THREE.RGBAFormat);
  // The rows are top first, so v counts down the image and no flip applies.
  texture.flipY = false;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.needsUpdate = true;
  return texture;
}

export interface BitmapQuads {
  /** `Float32Array`, 3 components/vertex, 4 vertices/glyph, order TL/TR/BL/BR. */
  positions: Float32Array;
  /** `Float32Array`, 2 components/vertex, same vertex order as `positions`. */
  uvs: Float32Array;
  /** `Uint32Array`, 6 indices/glyph. */
  indices: Uint32Array;
}

/** The glyphs of `layout` that draw ink: a glyph with a rectangle, a page fill and no hex-code box. */
function inkedGlyphs(layout: TextLayoutResult, bitmap: BitmapFont, sheet: FillSheet) {
  return layout.lines.flatMap((line, lineIndex) =>
    line.glyphs.flatMap((placement) => {
      const glyph =
        placement.controlCodepoint === undefined
          ? bitmap.glyphs.get(placement.char.codePointAt(0)!)
          : undefined;
      const rowOffset = glyph && sheet.rowOffsets[glyph.fillIndex];
      if (!glyph || rowOffset === undefined || glyph.width <= 0 || glyph.height <= 0) return [];
      return [{ glyph, rowOffset, penX: placement.x, lineIndex }];
    })
  );
}

/**
 * The quads of `layout`, drawn at `fontSizePx`. A pen position floors when the glyph is not scaled
 * (`text_server_adv.cpp:4084-4087`). A BMFont adds no subpixel shift: `FontFile::reset_state` sets
 * `SUBPIXEL_POSITIONING_DISABLED` (`font.cpp:1433`) and `_load_bitmap_font` starts with it.
 */
export function buildBitmapQuads(
  layout: TextLayoutResult,
  bitmap: BitmapFont,
  fontSizePx: number
): BitmapQuads {
  const sheet = sheetOf(bitmap);
  const inked = inkedGlyphs(layout, bitmap, sheet);
  const positions = new Float32Array(inked.length * 4 * 3);
  const uvs = new Float32Array(inked.length * 4 * 2);
  const indices = new Uint32Array(inked.length * 6);
  const scale = bitmapScale(bitmap.scaleMode, bitmap.fixedSize, fontSizePx);

  inked.forEach(({ glyph, rowOffset, penX, lineIndex }, quad) => {
    const baselinePx = lineIndex * layout.linePitchPx + layout.baselineOffsetPx;
    const originX = scale === 1 ? Math.floor(penX) : penX;
    const originY = scale === 1 ? Math.floor(baselinePx) : baselinePx;
    const left = originX + glyph.offsetX * scale;
    const top = originY + glyph.offsetY * scale;
    const right = left + glyph.width * scale;
    const bottom = top + glyph.height * scale;
    const vertex = quad * 4;
    positions.set([left, -top, 0, right, -top, 0, left, -bottom, 0, right, -bottom, 0], vertex * 3);

    const u0 = glyph.x / sheet.width;
    const u1 = (glyph.x + glyph.width) / sheet.width;
    const vTop = (rowOffset + glyph.y) / sheet.height;
    const vBottom = (rowOffset + glyph.y + glyph.height) / sheet.height;
    uvs.set([u0, vTop, u1, vTop, u0, vBottom, u1, vBottom], vertex * 2);
    indices.set([vertex + 2, vertex + 3, vertex, vertex + 3, vertex + 1, vertex], quad * 6);
  });
  return { positions, uvs, indices };
}
