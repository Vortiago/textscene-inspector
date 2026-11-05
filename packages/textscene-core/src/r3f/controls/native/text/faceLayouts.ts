/**
 * Splits a shaped layout into one layout per face its glyphs draw in, since each painter draws one
 * face (`TextRun.tsx`). A glyph from the **Fallback chain** keeps its place on its line.
 */
import type { FontMetrics } from './fontMetrics';
import type { GlyphPlacement, TextLayoutResult } from './textLayout';
import { perObject } from '../../../../utils/perObject';

/** One list per layout, so a painter memoised on each layout keeps its hits. */
export const faceLayouts = perObject(splitByFace);

function splitByFace(layout: TextLayoutResult): readonly TextLayoutResult[] {
  const faceOf = (glyph: GlyphPlacement): FontMetrics => glyph.fontMetrics ?? layout.fontMetrics;
  const faces = new Set(layout.lines.flatMap((line) => line.glyphs.map(faceOf)));
  if (faces.size === 0 || (faces.size === 1 && faces.has(layout.fontMetrics))) return [layout];
  return [...faces].map((face) => ({
    ...layout,
    fontMetrics: face,
    lines: layout.lines.map((line) => ({
      ...line,
      glyphs: line.glyphs.filter((glyph) => faceOf(glyph) === face),
    })),
  }));
}
