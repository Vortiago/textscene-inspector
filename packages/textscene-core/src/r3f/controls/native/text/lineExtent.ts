/**
 * The ascent and descent of a shaped line, which `_shape_substr` grows over the line's own glyphs
 * (`text_server_adv.cpp:5124-5175`), and the place of each line of a layout that steps by them
 * (`text_paragraph.cpp:701,759`).
 */
import type { FontMetrics } from './fontMetrics';
import { getFontSpacedAscentPx, getFontSpacedDescentPx } from './fontSpacing';
import { HEX_CODE_BOX_ASCENT, HEX_CODE_BOX_DESCENT, hexCodeBoxAdvanceSize } from './hexCodeBox';
import type { GlyphPlacement, TextLayoutResult, TextLineLayout } from './textLayout';

/** How far a line or a glyph reaches above and below its baseline, px. */
export interface LineExtentPx {
  ascentPx: number;
  descentPx: number;
}

/**
 * The extent of a line of `glyphs`: the largest over them of the face's ascent at the glyph's size,
 * `-y_off` and 0.85 of a hex-code box, and the same for the descent. A line with no glyph keeps the
 * line of `face` at `fontSizePx`, the span font its break shapes in.
 */
export function lineExtentPx(
  glyphs: readonly GlyphPlacement[],
  face: FontMetrics,
  fontSizePx: number
): LineExtentPx {
  if (glyphs.length === 0) {
    return {
      ascentPx: getFontSpacedAscentPx(face, fontSizePx),
      descentPx: getFontSpacedDescentPx(face, fontSizePx),
    };
  }
  let ascentPx = 0;
  let descentPx = 0;
  for (const glyph of glyphs) {
    const extent = glyphExtentPx(glyph);
    ascentPx = Math.max(ascentPx, extent.ascentPx);
    descentPx = Math.max(descentPx, extent.descentPx);
  }
  return { ascentPx, descentPx };
}

/**
 * How far `glyphs` reach below the baseline, by the rule of {@link lineExtentPx}, 0 for none. A run cut
 * from a line reads its own glyphs, so its raster does not take the descent of a deeper run beside it.
 */
export function glyphsDescentPx(glyphs: readonly GlyphPlacement[]): number {
  let descentPx = 0;
  for (const glyph of glyphs) descentPx = Math.max(descentPx, glyphExtentPx(glyph).descentPx);
  return descentPx;
}

const NO_EXTENT: LineExtentPx = { ascentPx: 0, descentPx: 0 };

// Godot grows the line to an infinite offset too, but a glyph there draws nothing, so it sizes nothing here.
function finiteShiftPx(yOffsetPx: number): number {
  return Number.isFinite(yOffsetPx) ? yOffsetPx : 0;
}

/** One glyph's share of its line's extent (`text_server_adv.cpp:5146-5172`). */
function glyphExtentPx(glyph: GlyphPlacement): LineExtentPx {
  const { fontMetrics: face, fontSizePx, char, yOffset = 0, controlCodepoint } = glyph;
  // An embedded object takes its width and no height: its control places it on the line.
  if (face.drawsApart?.(char)) return NO_EXTENT;
  if (controlCodepoint !== undefined) {
    const boxHeightPx = hexCodeBoxAdvanceSize(fontSizePx, controlCodepoint).y;
    return { ascentPx: boxHeightPx * HEX_CODE_BOX_ASCENT, descentPx: boxHeightPx * HEX_CODE_BOX_DESCENT };
  }
  return {
    ascentPx: Math.max(getFontSpacedAscentPx(face, fontSizePx), -finiteShiftPx(yOffset)),
    descentPx: Math.max(getFontSpacedDescentPx(face, fontSizePx), finiteShiftPx(yOffset)),
  };
}

/** The height `line` takes in a layout: its ascent, its descent and the line spacing after it. */
export function lineHeightPx(line: LineExtentPx, lineSpacingPx: number): number {
  return line.ascentPx + line.descentPx + lineSpacingPx;
}

/** The top of each line of `layout`, px down from the top of the first. */
export function lineTopsPx(layout: Pick<TextLayoutResult, 'lines' | 'lineSpacingPx'>): number[] {
  let topPx = 0;
  return layout.lines.map((line) => {
    const lineTopPx = topPx;
    topPx += lineHeightPx(line, layout.lineSpacingPx);
    return lineTopPx;
  });
}

/** The baseline of each line of `layout`, px down from the top of the first: its top plus its own ascent. */
export function lineBaselinesPx(layout: Pick<TextLayoutResult, 'lines' | 'lineSpacingPx'>): number[] {
  const topsPx = lineTopsPx(layout);
  return layout.lines.map((line, index) => topsPx[index]! + line.ascentPx);
}

/** The sum of the heights of `lines`. */
export function linesHeightPx(lines: readonly TextLineLayout[], lineSpacingPx: number): number {
  return lines.reduce((sumPx, line) => sumPx + lineHeightPx(line, lineSpacingPx), 0);
}

/** A line's `shaped_text_get_size().y`: its ascent plus descent, ceiled (`text_server_adv.cpp:7524-7537`). */
export function shapedLineHeightPx(line: LineExtentPx): number {
  return Math.ceil(line.ascentPx + line.descentPx);
}

/**
 * The size a text buffer reports: each line's {@link shapedLineHeightPx} plus the line spacing
 * (`text_paragraph.cpp:601-611`, `label_3d.cpp:265`).
 */
export function shapedBlockHeightPx(lines: readonly LineExtentPx[], lineSpacingPx: number): number {
  return lines.reduce((sumPx, line) => sumPx + shapedLineHeightPx(line) + lineSpacingPx, 0);
}

/** The largest ascent of a line of `layout`, or the layout's own baseline for none. */
export function tallestAscentPx(layout: Pick<TextLayoutResult, 'lines' | 'baselineOffsetPx'>): number {
  return (
    layout.lines.reduce((tallestPx, line) => Math.max(tallestPx, line.ascentPx), 0) || layout.baselineOffsetPx
  );
}
