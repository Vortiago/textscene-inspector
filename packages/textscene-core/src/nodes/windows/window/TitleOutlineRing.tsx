/**
 * The outline of a title shaped in the bundled atlas font: a stroked contour ring, which the atlas
 * field cannot encode, so the canvas painter draws it in the bundled canvas face (ADR-0040). It is
 * the module's default export for `React.lazy`, so the font bytes stay out of the initial bundle.
 */
import { useMemo } from 'react';
import type { FontResource } from '../../../resources/fonts/font/types';
import type { Rgba } from '../../../godot/math/math';
import { usePendingWhile } from '../../../resources/usePendingWhile';
import { bundledCanvasFace } from '../../../r3f/controls/native/text/bundledCanvasFace';
import { useSceneFontSettleCount } from '../../../r3f/controls/native/text/useSceneFontSettleCount';
import type { TextLayoutResult } from '../../../r3f/controls/native/text/textLayout';
import { TextRun } from '../../../r3f/controls/native/text/TextRun';
import { outlineStrokeWidthPx } from '../../3d/label3d/glyphLayout';

interface TitleOutlineRingProps {
  /** The title, shaped in the atlas face. The bundled canvas face reads the same baked table. */
  layout: TextLayoutResult;
  font: FontResource | null;
  fontSizePx: number;
  tint: Rgba;
  outlineSize: number;
  renderOrder: number;
}

export default function TitleOutlineRing({
  layout,
  font,
  fontSizePx,
  tint,
  outlineSize,
  renderOrder,
}: TitleOutlineRingProps) {
  const face = bundledCanvasFace(font, layout.fontMetrics);
  // Stable while the face is: `TextRun` rebuilds its glyph texture on a new layout.
  const faceLayout = useMemo(() => face && { ...layout, fontMetrics: face }, [layout, face]);
  usePendingWhile(faceLayout === undefined);
  // Listens only while the face is missing, so a drawn ring re-renders for no later settle.
  useSceneFontSettleCount(faceLayout === undefined);
  if (!faceLayout) return null;
  return (
    <TextRun
      layout={faceLayout}
      fontSizePx={fontSizePx}
      tint={tint}
      strokeWidthPx={outlineStrokeWidthPx(outlineSize)}
      renderOrder={renderOrder}
    />
  );
}
