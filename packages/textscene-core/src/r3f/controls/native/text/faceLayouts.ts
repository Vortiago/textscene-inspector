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
  // One face is the common case, and it keeps the layout itself without a copy.
  if (layout.lines.every((line) => line.glyphs.every((glyph) => faceOf(glyph) === layout.fontMetrics)))
    return [layout];
  const glyphsByFace = new Map<FontMetrics, GlyphPlacement[][]>();
  layout.lines.forEach((line, lineIndex) => {
    for (const glyph of line.glyphs) {
      const face = faceOf(glyph);
      let lines = glyphsByFace.get(face);
      if (!lines) glyphsByFace.set(face, (lines = layout.lines.map(() => [])));
      lines[lineIndex]!.push(glyph);
    }
  });
  return [...glyphsByFace].map(([face, glyphsByLine]) => ({
    ...layout,
    fontMetrics: face,
    lines: layout.lines.map((line, lineIndex) => ({ ...line, glyphs: glyphsByLine[lineIndex]! })),
  }));
}
