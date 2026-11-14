/**
 * A run on the bundled font, which Godot draws through FreeType: the fill from the hinted outline,
 * an embolden grown at every value (`text_server_adv.cpp:1313-1316`), and a stroked outline ring
 * (ADR-0069). It draws on the canvas painter through the bundled canvas face.
 */
import { useMemo } from 'react';
import { useBundledCanvasFace } from './bundledCanvasFace';
import { TextRunMesh, type TextRunProps } from './TextRunMesh';
import { usePendingWhile } from '../../../../resources/usePendingWhile';

/** Draws nothing while the outlines of the bundled font or the project settings load, and counts as a pending load meanwhile. */
export default function BundledCanvasRun({ layout, ...run }: TextRunProps) {
  // `withVariation` memoises the face, so a render keeps its identity.
  const face = useBundledCanvasFace()(layout.fontMetrics);
  const isLoading = face === undefined;
  usePendingWhile(isLoading);
  // The canvas face keeps the baked advances, so the layout of the bundled face places its glyphs.
  const canvasLayout = useMemo(() => face && { ...layout, fontMetrics: face }, [layout, face]);
  return canvasLayout ? <TextRunMesh {...run} layout={canvasLayout} /> : null;
}
