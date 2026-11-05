/**
 * A run on the bundled font that the atlas field cannot carry: an embolden, which Godot grows with
 * FreeType at every value (`text_server_adv.cpp:1313-1316`), or a stroked outline ring, a real
 * contour annulus (ADR-0040). It draws on the canvas painter through the bundled canvas face. This
 * module is `React.lazy`, so the font bytes stay out of the initial bundle.
 */
import { useMemo } from 'react';
import { peekBundledCanvasFontMetrics } from './bundledFontLoader';
import { withVariation, type FontMetrics } from './fontMetrics';
import { peekGlyphOutlines } from './sceneFontOutlines';
import { TextRun, type TextRunProps } from './TextRun';
import { useSceneFontSettleCount } from './useSceneFontSettleCount';
import { usePendingWhile } from '../../../../resources/usePendingWhile';

/**
 * The bundled canvas face carrying the variation of `atlasFace`. Undefined while the face or its
 * outlines load, and null when the face cannot register, which the loader has warned about.
 */
function bundledCanvasFace(atlasFace: FontMetrics): FontMetrics | null | undefined {
  const bundled = peekBundledCanvasFontMetrics();
  if (!bundled) return bundled;
  const outlines = peekGlyphOutlines(null, bundled, atlasFace);
  if (outlines === undefined) return undefined;
  // Null is no outlines to follow: an unvaried face, or one this reader cannot open.
  return withVariation(bundled, {
    embolden: atlasFace.embolden,
    skew: atlasFace.skew,
    outlines: outlines ?? undefined,
  });
}

/** Draws nothing until the bundled face settles, so no run paints against the wrong face. */
export default function BundledCanvasRun({ layout, ...run }: TextRunProps) {
  const settleCount = useSceneFontSettleCount(true);
  // The settle count is the memo's key: a load that settles re-reads the peeks.
  // eslint-disable-next-line react-hooks/exhaustive-deps -- see above.
  const face = useMemo(() => bundledCanvasFace(layout.fontMetrics), [layout.fontMetrics, settleCount]);
  // The canvas face keeps the baked advances, so the atlas layout places its glyphs.
  const canvasLayout = useMemo(() => (face ? { ...layout, fontMetrics: face } : face), [layout, face]);
  usePendingWhile(canvasLayout === undefined);
  if (!canvasLayout) return null;
  return <TextRun {...run} layout={canvasLayout} />;
}
