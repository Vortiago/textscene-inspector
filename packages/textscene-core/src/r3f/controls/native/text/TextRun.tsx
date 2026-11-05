/**
 * The text run every text-painting Control draws: one run for each face its glyphs draw in
 * (`faceLayouts.ts`), each on the painter it needs. An emboldened atlas face, and an atlas outline
 * ring, draw on the bundled canvas face (`BundledCanvasRun.tsx`): Godot's default font is not MSDF
 * (`text_server.cpp:2386`), so FreeType grows its outline at every embolden, and a ring is a stroked
 * contour the field cannot carry (ADR-0040).
 */
import BundledCanvasRun from './BundledCanvasRun';
import { faceLayouts } from './faceLayouts';
import type { FontMetrics } from './fontMetrics';
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
  if (fontMetrics.kind === 'atlas' && needsContour) return <BundledCanvasRun {...props} />;
  return <TextRunMesh {...props} />;
}
