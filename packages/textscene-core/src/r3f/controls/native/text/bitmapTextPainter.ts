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
import type { FillSheet } from '../../../../resources/fonts/font/types';
import type { BitmapFontMetrics } from './bitmapFontMetrics';
import type { GlyphPlacement, TextLayoutResult } from './textLayout';

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

/** The glyph a placement draws, or undefined for a hex-code box, a space and a glyph no fill of `sheet` holds. */
function inkedGlyph(placement: GlyphPlacement, metrics: BitmapFontMetrics, sheet: FillSheet) {
  if (placement.controlCodepoint !== undefined) return undefined;
  const glyph = metrics.glyphOf(placement.char);
  const hasInk =
    glyph && glyph.width > 0 && glyph.height > 0 && sheet.rowOffsets[glyph.fillIndex] !== undefined;
  return hasInk ? glyph : undefined;
}

/**
 * The quads of `layout`, drawn at `fontSizePx` over `sheet`: the glyph sheet, or the outline sheet
 * for an outline pass. A pen position floors when the glyph is not scaled
 * (`text_server_adv.cpp:4084-4087`). A BMFont adds no subpixel shift: `FontFile::reset_state` sets
 * `SUBPIXEL_POSITIONING_DISABLED` (`font.cpp:1433`) and `_load_bitmap_font` starts with it.
 */
export function buildBitmapQuads(
  layout: TextLayoutResult,
  metrics: BitmapFontMetrics,
  fontSizePx: number,
  sheet: FillSheet
): BitmapQuads {
  const placements = layout.lines.flatMap((line, lineIndex) =>
    line.glyphs.map((placement) => ({ placement, lineIndex }))
  );
  const inkedCount = placements.filter(({ placement }) => inkedGlyph(placement, metrics, sheet)).length;
  const positions = new Float32Array(inkedCount * 4 * 3);
  const uvs = new Float32Array(inkedCount * 4 * 2);
  const indices = new Uint32Array(inkedCount * 6);
  const scale = metrics.pxPerUnit(fontSizePx);
  const sheetWidthInverse = 1 / sheet.width;
  const sheetHeightInverse = 1 / sheet.height;

  let quad = 0;
  for (const { placement, lineIndex } of placements) {
    const glyph = inkedGlyph(placement, metrics, sheet);
    if (!glyph) continue;
    const rowOffset = sheet.rowOffsets[glyph.fillIndex]!;
    const baselinePx = lineIndex * layout.linePitchPx + layout.baselineOffsetPx;
    const originX = scale === 1 ? Math.floor(placement.x) : placement.x;
    const originY = scale === 1 ? Math.floor(baselinePx) : baselinePx;
    const left = originX + glyph.offsetX * scale;
    const top = originY + glyph.offsetY * scale;
    const right = left + glyph.width * scale;
    const bottom = top + glyph.height * scale;
    const vertex = quad * 4;
    positions.set([left, -top, 0, right, -top, 0, left, -bottom, 0, right, -bottom, 0], vertex * 3);

    const u0 = glyph.x * sheetWidthInverse;
    const u1 = (glyph.x + glyph.width) * sheetWidthInverse;
    const vTop = (rowOffset + glyph.y) * sheetHeightInverse;
    const vBottom = (rowOffset + glyph.y + glyph.height) * sheetHeightInverse;
    uvs.set([u0, vTop, u1, vTop, u0, vBottom, u1, vBottom], vertex * 2);
    indices.set([vertex + 2, vertex + 3, vertex, vertex + 3, vertex + 1, vertex], quad * 6);
    quad++;
  }
  return { positions, uvs, indices };
}
