/**
 * `<OutlinedTextRun>`: a `<TextRun>` that draws the theme text outline of `Button`, `ProgressBar`
 * and the Controls that share their pass (`button.cpp:458-462`): a stroked ring, then the fill.
 */
import { lazy, useMemo } from 'react';
import { multiplyModulate } from '../../../canvasItemModulate';
import type { Rgba } from '../../../../godot/math/math';
import { outlineStrokeWidthPx } from './textOutline';
import { resolveTextOutline, type TextOutlineTheme } from '../textTheme';
import type { ShareNode } from '../solveTree';
import { isBitmapFontMetrics } from './bitmapFontMetrics';
import { isCanvasFontMetrics } from './runtimeFontMetrics';
import { TextRun, type TextRunProps } from './TextRun';
import type { TextLayoutResult } from './textLayout';
import { PendingSuspense } from '../../../../resources/PendingSuspense';

// The bundled font bytes load with the ring, not with every Control.
const BundledOutlineRing = lazy(() => import('./BundledOutlineRing'));

/**
 * The render order of layer `index` of `count` stacked text layers: the layers spread over the
 * one unit below the next Control's order, so they keep their draw order, which three does not
 * keep for two runs of one order, and none reaches the Control that follows.
 */
export function textLayerRenderOrder(renderOrder: number, index: number, count: number): number {
  return renderOrder + index / count;
}

/** The outline theme of `n` multiplied by the Control's own tint, in sRGB, as `<TextRun>` converts it once. */
export function useTintedTextOutline(
  n: Pick<ShareNode, 'colors' | 'constants'>,
  ownTint: Rgba
): TextOutlineTheme {
  const { color, sizePx } = resolveTextOutline(n);
  return useMemo(() => ({ color: multiplyModulate(color, ownTint), sizePx }), [color, sizePx, ownTint]);
}

type RunLookProps = Pick<TextRunProps, 'layout' | 'fontSizePx' | 'tint' | 'clippingPlanes' | 'renderOrder'>;

type OutlineRingRunProps = RunLookProps & {
  /** `outline_size` in px. */
  sizePx: number;
};

/**
 * One stroked outline ring, without the fill (ADR-0040). A canvas face strokes its own ring. A
 * BMFont draws its outline set. The bundled atlas face strokes it on the bundled canvas face, and
 * its pass waits for that face.
 */
export function OutlineRingRun({ sizePx, ...run }: OutlineRingRunProps) {
  const ring = { ...run, strokeWidthPx: outlineStrokeWidthPx(sizePx) };
  const { fontMetrics } = run.layout;
  if (isCanvasFontMetrics(fontMetrics) || isBitmapFontMetrics(fontMetrics)) return <TextRun {...ring} />;
  return (
    <PendingSuspense>
      <BundledOutlineRing {...ring} />
    </PendingSuspense>
  );
}

type OutlinedTextRunProps = RunLookProps & {
  /** Already tinted. No outline draws at a size of 0 or a zero alpha (`button.cpp:460`). */
  outline: TextOutlineTheme;
  /** The ring's own shape when it differs from the fill's, as a trimmed AUTO line's does. Defaults to `layout`. */
  outlineLayout?: TextLayoutResult;
};

export function OutlinedTextRun({
  layout,
  outlineLayout = layout,
  outline,
  renderOrder = 0,
  ...run
}: OutlinedTextRunProps) {
  const hasRing = outline.sizePx > 0 && outline.color.a > 0;
  const layerCount = hasRing ? 2 : 1;
  return (
    <>
      {hasRing && (
        <OutlineRingRun
          {...run}
          layout={outlineLayout}
          tint={outline.color}
          sizePx={outline.sizePx}
          renderOrder={textLayerRenderOrder(renderOrder, 0, layerCount)}
        />
      )}
      <TextRun
        {...run}
        layout={layout}
        renderOrder={textLayerRenderOrder(renderOrder, layerCount - 1, layerCount)}
      />
    </>
  );
}
