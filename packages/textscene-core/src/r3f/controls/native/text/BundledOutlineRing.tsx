/**
 * The stroked outline ring of a run on the bundled font. Godot strokes a real contour annulus
 * (ADR-0040), which the atlas field cannot carry at a large `outline_size`, so the ring draws on
 * the canvas painter through the bundled canvas face and the fill stays on the atlas. This module
 * is `React.lazy` from `OutlinedTextRun.tsx`, so the font bytes stay out of the initial bundle.
 */
import { useMemo } from 'react';
import { peekBundledCanvasFontMetrics } from './bundledFontLoader';
import { withVariation, type FontMetrics } from './fontMetrics';
import { peekGlyphOutlines } from './sceneFontOutlines';
import type { TextLayoutResult } from './textLayout';
import { TextRun, type TextRunProps } from './TextRun';
import { useSceneFontSettleCount } from './useSceneFontSettleCount';

type BundledOutlineRingProps = Pick<
  TextRunProps,
  'fontSizePx' | 'tint' | 'clippingPlanes' | 'renderOrder'
> & {
  /** Shaped on the atlas face, whose baked advances the canvas face reads too. */
  layout: TextLayoutResult;
  strokeWidthPx: number;
};

/** The bundled canvas face carrying the variation of `atlasFace`. Undefined while the face or its outlines load. */
function bundledRingFace(atlasFace: FontMetrics): FontMetrics | undefined {
  const bundled = peekBundledCanvasFontMetrics();
  if (!bundled) return undefined;
  const outlines = peekGlyphOutlines(null, bundled, atlasFace);
  if (outlines === undefined) return undefined;
  // Null is no outlines to follow: an unvaried face, or one this reader cannot open.
  return withVariation(bundled, {
    embolden: atlasFace.embolden,
    skew: atlasFace.skew,
    outlines: outlines ?? undefined,
  });
}

/** Draws nothing until the bundled face settles, so no ring paints against the wrong face. */
export default function BundledOutlineRing({ layout, ...run }: BundledOutlineRingProps) {
  const settleCount = useSceneFontSettleCount(true);
  // The settle count is the memo's key: a load that settles re-reads the peeks.
  // eslint-disable-next-line react-hooks/exhaustive-deps -- see above.
  const face = useMemo(() => bundledRingFace(layout.fontMetrics), [layout.fontMetrics, settleCount]);
  const ringLayout = useMemo(() => (face ? { ...layout, fontMetrics: face } : null), [layout, face]);
  if (!ringLayout) return null;
  return <TextRun {...run} layout={ringLayout} />;
}
