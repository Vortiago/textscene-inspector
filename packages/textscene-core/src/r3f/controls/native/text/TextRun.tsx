/**
 * The text run every text-painting Control draws: it picks the painter a run needs. A run of the
 * bundled atlas face draws on the bundled canvas face (`BundledCanvasRun.tsx`): Godot's default font
 * is not MSDF (`text_server.cpp:2386`), so FreeType fills and strokes every glyph from its outline
 * (ADR-0040).
 */
import BundledCanvasRun from './BundledCanvasRun';
import { TextRunMesh, type TextRunProps } from './TextRunMesh';

export type { TextRunProps } from './TextRunMesh';

export function TextRun(props: TextRunProps) {
  if (props.layout.fontMetrics.kind === 'atlas') return <BundledCanvasRun {...props} />;
  return <TextRunMesh {...props} />;
}
