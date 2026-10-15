/**
 * The MSDF atlas painter's geometry: every visible glyph of a `shapeText` layout as one merged quad
 * set. Geometry is in Godot pixels, +Y down, with Y negated once per vertex into three's Y-up space.
 * Each line's top is a multiple of `layout.linePitchPx`, and its baseline sits
 * `layout.baselineOffsetPx` below that, as Godot's `ofs.y += asc` does (`scene/gui/label.cpp:616,823`).
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */
import { OPEN_SANS_ATLAS_INFO } from './openSansAtlas';
import type { TextLayoutResult } from './textLayout';

/** The vertex, UV and index buffers of one merged glyph quad set. */
export interface GlyphQuadArrays {
  /** `Float32Array`, 3 components/vertex, 4 vertices/glyph, order TL/TR/BL/BR. */
  positions: Float32Array;
  /** `Float32Array`, 2 components/vertex, same vertex order as `positions`. */
  uvs: Float32Array;
  /** `Uint32Array`, 6 indices/glyph (two triangles). */
  indices: Uint32Array;
}

/** Atlas pixel rect (image-Y top-left, bake-size px) -> UV rect, flipY=true convention. */
function atlasUv(x: number, y: number, width: number, height: number) {
  const { scaleW, scaleH } = OPEN_SANS_ATLAS_INFO;
  return {
    u0: x / scaleW,
    u1: (x + width) / scaleW,
    vTop: 1 - y / scaleH,
    vBottom: 1 - (y + height) / scaleH,
  };
}

/**
 * Builds one merged quad set for `layout`, skipping a placement with no atlas
 * bitmap. It reconciles the atlas's bake anchor (`OPEN_SANS_ATLAS_INFO.base`, which
 * every `yoffset` is measured from) with the line's baseline, so a caller never adds it.
 */
// `skew` shears about the baseline: Godot's `FT_Outline_Transform` works on the
// loaded outline, whose origin is the baseline pen position
// (`modules/text_server_adv/text_server_adv.cpp:1318-1320`, `:3621-3623`). A top-edge
// pivot would shift a styled `[i]` run left, into the space before it.
export function buildGlyphQuadArrays(
  layout: TextLayoutResult,
  fontSizePx: number,
  skew: number
): GlyphQuadArrays {
  const scale = fontSizePx / OPEN_SANS_ATLAS_INFO.fontSize;
  const baselineOffsetPx = layout.baselineOffsetPx;
  // How far the bake's line-top reference sits above the baseline, at the target size. A run
  // smaller than its line's size reads a few tenths of a pixel low, from Godot's per-size FreeType
  // hinting. `textRun.md` says why, and why no closed-form fix works without porting the hinter.
  const bakeAnchorPx = OPEN_SANS_ATLAS_INFO.base * scale;

  let glyphCount = 0;
  for (const line of layout.lines) {
    for (const gp of line.glyphs) {
      if (gp.glyph && gp.glyph.width > 0 && gp.glyph.height > 0) glyphCount++;
    }
  }

  const positions = new Float32Array(glyphCount * 4 * 3);
  const uvs = new Float32Array(glyphCount * 4 * 2);
  const indices = new Uint32Array(glyphCount * 6);

  let quad = 0;
  layout.lines.forEach((line, lineIndex) => {
    const lineTopPx = lineIndex * layout.linePitchPx;
    const baselinePx = lineTopPx + baselineOffsetPx;
    for (const gp of line.glyphs) {
      const glyph = gp.glyph;
      if (!glyph || glyph.width <= 0 || glyph.height <= 0) continue;

      const leftPx = gp.x + glyph.xoffset * scale;
      const topPx = baselinePx - bakeAnchorPx + glyph.yoffset * scale;
      const rightPx = leftPx + glyph.width * scale;
      const bottomPx = topPx + glyph.height * scale;

      const dx = (yPx: number): number => -skew * (yPx - baselinePx);
      const tl: [number, number] = [leftPx + dx(topPx), topPx];
      const tr: [number, number] = [rightPx + dx(topPx), topPx];
      const bl: [number, number] = [leftPx + dx(bottomPx), bottomPx];
      const br: [number, number] = [rightPx + dx(bottomPx), bottomPx];

      const v = quad * 4;
      positions.set([tl[0], -tl[1], 0, tr[0], -tr[1], 0, bl[0], -bl[1], 0, br[0], -br[1], 0], v * 3);

      const uv = atlasUv(glyph.x, glyph.y, glyph.width, glyph.height);
      uvs.set([uv.u0, uv.vTop, uv.u1, uv.vTop, uv.u0, uv.vBottom, uv.u1, uv.vBottom], v * 2);

      indices.set([v + 2, v + 3, v, v + 3, v + 1, v], quad * 6);
      quad++;
    }
  });

  return { positions, uvs, indices };
}
