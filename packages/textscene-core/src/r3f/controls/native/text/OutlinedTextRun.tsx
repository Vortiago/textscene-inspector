/**
 * `<OutlinedTextRun>`: a `<TextRun>` that draws the theme text outline of `Button`, `ProgressBar`
 * and the Controls that share their pass (`button.cpp:458-462`): a stroked ring, then the fill.
 */
import { lazy, Suspense, useMemo } from 'react';
import { multiplyModulate } from '../../../canvasItemModulate';
import type { Rgba } from '../../../../godot/math/math';
import { outlineStrokeWidthPx } from './textOutline';
import { resolveTextOutline, type TextOutlineTheme } from '../textTheme';
import type { ShareNode } from '../solveTree';
import { isCanvasFontMetrics } from './runtimeFontMetrics';
import { TextRun, type TextRunProps } from './TextRun';

// The bundled font bytes load with the ring, not with every Control.
const BundledOutlineRing = lazy(() => import('./BundledOutlineRing'));

/**
 * The fill draws above the stroked ring. Two runs of one renderOrder sort by creation, and the
 * ring's mesh can be created after the fill's. Less than the step between two Controls' render
 * orders, so the fill stays below the next Control.
 */
const FILL_ABOVE_RING = 0.05;

/** The outline theme of `n` multiplied by the Control's own tint, in sRGB, as `<TextRun>` converts it once. */
export function useTintedTextOutline(
  n: Pick<ShareNode, 'colors' | 'constants'>,
  ownTint: Rgba
): TextOutlineTheme {
  const { color, sizePx } = resolveTextOutline(n);
  return useMemo(() => ({ color: multiplyModulate(color, ownTint), sizePx }), [color, sizePx, ownTint]);
}

type OutlinedTextRunProps = Pick<
  TextRunProps,
  'layout' | 'fontSizePx' | 'tint' | 'clippingPlanes' | 'renderOrder'
> & {
  /** Already tinted. No outline draws at a size of 0 or a zero alpha (`button.cpp:460`). */
  outline: TextOutlineTheme;
};

export function OutlinedTextRun({ layout, outline, renderOrder = 0, ...run }: OutlinedTextRunProps) {
  const hasRing = outline.sizePx > 0 && outline.color.a > 0;
  const ring = {
    ...run,
    layout,
    tint: outline.color,
    strokeWidthPx: outlineStrokeWidthPx(outline.sizePx),
    renderOrder,
  };
  return (
    <>
      {hasRing &&
        (isCanvasFontMetrics(layout.fontMetrics) ? (
          <TextRun {...ring} />
        ) : (
          <Suspense fallback={null}>
            <BundledOutlineRing {...ring} />
          </Suspense>
        ))}
      <TextRun {...run} layout={layout} renderOrder={hasRing ? renderOrder + FILL_ABOVE_RING : renderOrder} />
    </>
  );
}
