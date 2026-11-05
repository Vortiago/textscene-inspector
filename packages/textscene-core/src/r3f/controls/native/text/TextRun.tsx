/**
 * The text run every text-painting Control draws: one run for each face its glyphs draw in
 * (`faceLayouts.ts`), each on the painter it needs. An emboldened atlas face, and an atlas outline
 * ring, draw on the bundled canvas face (`BundledCanvasRun.tsx`): Godot's default font is not MSDF
 * (`text_server.cpp:2386`), so FreeType grows its outline at every embolden, and a ring is a stroked
 * contour the field cannot carry (ADR-0040).
 */
import BundledCanvasRun from './BundledCanvasRun';
import { faceLayouts } from './faceLayouts';
import { TextRunMesh, type TextRunProps } from './TextRunMesh';

export type { TextRunProps } from './TextRunMesh';

export function TextRun(props: TextRunProps) {
  return faceLayouts(props.layout).map((layout, i) => <FaceRun key={i} {...props} layout={layout} />);
}

function FaceRun(props: TextRunProps) {
  const { fontMetrics } = props.layout;
  const needsContour = !!fontMetrics.embolden || (props.strokeWidthPx ?? 0) > 0;
  if (fontMetrics.kind === 'atlas' && needsContour) return <BundledCanvasRun {...props} />;
  return <TextRunMesh {...props} />;
}
