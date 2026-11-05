/**
 * A run on the bundled font, which Godot draws through FreeType: the fill from the hinted outline,
 * an embolden grown at every value (`text_server_adv.cpp:1313-1316`), and a stroked outline ring
 * (ADR-0040). It draws on the canvas painter through the bundled canvas face.
 */
import { useMemo } from 'react';
import { peekBundledCanvasFace } from './bundledCanvasFace';
import { TextRunMesh, type TextRunProps } from './TextRunMesh';
import { useSceneFontSettleCount } from './useSceneFontSettleCount';
import { usePendingWhile } from '../../../../resources/usePendingWhile';

/** Draws nothing until the bundled face settles, so no run paints against the wrong face. */
export default function BundledCanvasRun({ layout, ...run }: TextRunProps) {
  // `withVariation` memoises the face, so a render keeps its identity. Null is a face that cannot
  // register, and the loader has warned.
  const face = peekBundledCanvasFace(layout.fontMetrics);
  // Listens only while the face loads. The count re-renders a run whose settle lands first.
  useSceneFontSettleCount(face === undefined);
  // The canvas face keeps the baked advances, so the atlas layout places its glyphs.
  const canvasLayout = useMemo(() => face && { ...layout, fontMetrics: face }, [layout, face]);
  usePendingWhile(face === undefined);
  if (canvasLayout) return <TextRunMesh {...run} layout={canvasLayout} />;
  // Where the face cannot register, the atlas fill keeps the text visible. The atlas cannot stroke a ring.
  const isFill = !((run.strokeWidthPx ?? 0) > 0);
  if (face === null && isFill) return <TextRunMesh {...run} layout={layout} />;
  return null;
}
