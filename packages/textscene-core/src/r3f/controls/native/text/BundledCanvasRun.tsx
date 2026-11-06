/**
 * A run on the bundled font, which Godot draws through FreeType: the fill from the hinted outline,
 * an embolden grown at every value (`text_server_adv.cpp:1313-1316`), and a stroked outline ring
 * (ADR-0040). It draws on the canvas painter through the bundled canvas face.
 */
import { useMemo } from 'react';
import { useBundledCanvasFace } from './bundledCanvasFace';
import { TextRunMesh, type TextRunProps } from './TextRunMesh';
import { useSceneFontSettleCount } from './useSceneFontSettleCount';
import { usePendingWhile } from '../../../../resources/usePendingWhile';

/** Fills on the atlas until the bundled face settles, as Godot always has its default font to draw. */
export default function BundledCanvasRun({ layout, ...run }: TextRunProps) {
  // `withVariation` memoises the face, so a render keeps its identity. Null is a face that cannot
  // register, and the loader has warned.
  const face = useBundledCanvasFace()(layout.fontMetrics);
  // Listens only while the face loads. The count re-renders a run whose settle lands first.
  useSceneFontSettleCount(face === undefined);
  // The canvas face keeps the baked advances, so the atlas layout places its glyphs.
  const canvasLayout = useMemo(() => face && { ...layout, fontMetrics: face }, [layout, face]);
  usePendingWhile(face === undefined);
  if (canvasLayout) return <TextRunMesh {...run} layout={canvasLayout} />;
  // While the face registers, or where it cannot, the atlas fill keeps the text visible. The atlas
  // cannot stroke a ring.
  const isFill = !((run.strokeWidthPx ?? 0) > 0);
  return isFill ? <TextRunMesh {...run} layout={layout} /> : null;
}
