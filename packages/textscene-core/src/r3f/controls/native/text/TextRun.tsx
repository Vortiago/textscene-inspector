/**
 * The text run every text-painting Control draws: one run for each face its glyphs draw in
 * (`faceLayouts.ts`), each on the painter it needs. An emboldened atlas face, an atlas outline ring
 * and an atlas run with a ligature or a mark draw on the bundled canvas face (`BundledCanvasRun.tsx`): Godot's
 * default font is not MSDF (`text_server.cpp:2386`), so FreeType grows its outline at every embolden,
 * a ring is a stroked contour the field cannot carry (ADR-0040), and the atlas holds no ligature or mark glyph.
 */
import BundledCanvasRun from './BundledCanvasRun';
import { faceLayouts } from './faceLayouts';
import type { FontMetrics } from './fontMetrics';
import type { GlyphPlacement, TextLayoutResult } from './textLayout';
import { perObject } from '../../../../utils/perObject';
import { TextRunMesh, type TextRunProps as TextRunMeshProps } from './TextRunMesh';

export interface TextRunProps extends TextRunMeshProps {
  /** The `mipmapped` of each fallback face, by its metrics. A face it lacks takes `mipmapped`. */
  fallbackMipmaps?: ReadonlyMap<FontMetrics, boolean>;
}

export function TextRun({ fallbackMipmaps, ...props }: TextRunProps) {
  return faceLayouts(props.layout).map((layout, i) => (
    <FaceRun
      key={i}
      {...props}
      layout={layout}
      mipmapped={fallbackMipmaps?.get(layout.fontMetrics) ?? props.mipmapped}
    />
  ));
}

function FaceRun(props: TextRunMeshProps) {
  const { fontMetrics } = props.layout;
  const needsContour = !!fontMetrics.embolden || (props.strokeWidthPx ?? 0) > 0;
  if (fontMetrics.kind === 'atlas' && (needsContour || drawsOutsideAtlas(props.layout)))
    return <BundledCanvasRun {...props} />;
  return <TextRunMesh {...props} />;
}

/**
 * Whether `layout` draws a glyph the atlas lacks: a ligature or a swapped glyph, a mark, or a
 * character that a base and marks compose into outside the atlas charset. Kept per layout, as a
 * render reads it again on an unchanged layout.
 */
const drawsOutsideAtlas = perObject((layout: TextLayoutResult): boolean =>
  layout.lines.some((line) => line.glyphs.some(isOutsideAtlas))
);

function isOutsideAtlas(glyph: GlyphPlacement): boolean {
  const { decomposition } = glyph;
  if (glyph.glyphIndex !== undefined) return true;
  return !!decomposition && (decomposition.marks.length > 0 || glyph.glyph === null);
}
