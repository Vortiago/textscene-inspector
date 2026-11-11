/**
 * The text run every text-painting Control draws: one run for each face its glyphs draw in
 * (`faceLayouts.ts`), each on the painter it needs. A run of the bundled face draws on the
 * bundled canvas face (`BundledCanvasRun.tsx`): Godot's default font is not MSDF
 * (`text_server.cpp:2386`), so FreeType fills and strokes every glyph from its outline (ADR-0066).
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
  if (props.layout.fontMetrics.kind === 'bundled') return <BundledCanvasRun {...props} />;
  return <TextRunMesh {...props} />;
}
