/**
 * The outline of a title shaped in the bundled atlas font: a stroked contour ring, which the atlas
 * field cannot encode, so the canvas painter draws it in the bundled canvas face (ADR-0040). It is
 * the module's default export for `React.lazy`, so the font bytes stay out of the initial bundle.
 */
import type { FontResource } from '../../../resources/fonts/font/types';
import type { Rgba } from '../../../godot/math/math';
import { usePendingWhile } from '../../../resources/usePendingWhile';
import { peekBundledCanvasFontMetrics } from '../../../r3f/controls/native/text/bundledFontLoader';
import { withOutlines, withVariation, type FontMetrics } from '../../../r3f/controls/native/text/fontMetrics';
import type { CanvasFontMetrics } from '../../../r3f/controls/native/text/runtimeFontMetrics';
import { peekGlyphOutlines } from '../../../r3f/controls/native/text/sceneFontOutlines';
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

/** The bundled canvas face varied as `atlas` is, or `undefined` while it or its outlines load. */
function canvasFaceOf(font: FontResource | null, atlas: FontMetrics): CanvasFontMetrics | undefined {
  const bundled = peekBundledCanvasFontMetrics();
  if (!bundled) return undefined;
  const outlines = peekGlyphOutlines(font, bundled, atlas);
  if (outlines === undefined) return undefined;
  const varied = withVariation(bundled, atlas);
  return outlines ? withOutlines(varied, outlines) : varied;
}

export default function TitleOutlineRing({
  layout,
  font,
  fontSizePx,
  tint,
  outlineSize,
  renderOrder,
}: TitleOutlineRingProps) {
  const face = canvasFaceOf(font, layout.fontMetrics);
  usePendingWhile(face === undefined);
  // Listens only while the face is missing, so a drawn ring re-renders for no later settle.
  useSceneFontSettleCount(face === undefined);
  if (!face) return null;
  return (
    <TextRun
      layout={{ ...layout, fontMetrics: face }}
      fontSizePx={fontSizePx}
      tint={tint}
      strokeWidthPx={outlineStrokeWidthPx(outlineSize)}
      renderOrder={renderOrder}
    />
  );
}
