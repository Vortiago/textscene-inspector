/**
 * `<OutlinedTextRun>`: a `<TextRun>` that draws the theme text outline of a Control that draws a
 * text buffer (`button.cpp:458-462`, `link_button.cpp:294-301` and others): a stroked ring, then
 * the fill.
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
  ownTint: Rgba,
  defaultColor?: Rgba
): TextOutlineTheme {
  const { color, sizePx } = resolveTextOutline(n, defaultColor);
  return useMemo(() => ({ color: multiplyModulate(color, ownTint), sizePx }), [color, sizePx, ownTint]);
}

export type RunLookProps = Pick<
  TextRunProps,
  'layout' | 'fontSizePx' | 'tint' | 'clippingPlanes' | 'renderOrder' | 'penOriginXPx'
>;

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
  /** Already tinted. */
  outline: TextOutlineTheme;
};

/** `layout` as `shaped_text_draw_outline` draws it: each line's `outlineGlyphs` where it has them. */
function outlineLayout(layout: TextLayoutResult): TextLayoutResult {
  if (!layout.lines.some((line) => line.outlineGlyphs)) return layout;
  return {
    ...layout,
    lines: layout.lines.map((line) => (line.outlineGlyphs ? { ...line, glyphs: line.outlineGlyphs } : line)),
  };
}

/** No outline draws at a size of 0 or a zero alpha (`button.cpp:460`). */
function hasOutlineRing(outline: TextOutlineTheme): boolean {
  return outline.sizePx > 0 && outline.color.a > 0;
}

type TextOutlineRingProps = Omit<RunLookProps, 'tint'> & {
  /** Already tinted. */
  outline: TextOutlineTheme;
};

/** The theme outline ring of `layout` without its fill, as ItemList draws it under a fill it hides (`item_list.cpp:1672-1688`). */
export function TextOutlineRing({ layout, outline, ...run }: TextOutlineRingProps) {
  const ringLayout = useMemo(() => outlineLayout(layout), [layout]);
  if (!hasOutlineRing(outline)) return null;
  return <OutlineRingRun {...run} layout={ringLayout} tint={outline.color} sizePx={outline.sizePx} />;
}

export function OutlinedTextRun({ layout, outline, renderOrder = 0, ...run }: OutlinedTextRunProps) {
  const layerCount = hasOutlineRing(outline) ? 2 : 1;
  return (
    <>
      <TextOutlineRing
        {...run}
        layout={layout}
        outline={outline}
        renderOrder={textLayerRenderOrder(renderOrder, 0, layerCount)}
      />
      <TextRun
        {...run}
        layout={layout}
        renderOrder={textLayerRenderOrder(renderOrder, layerCount - 1, layerCount)}
      />
    </>
  );
}
