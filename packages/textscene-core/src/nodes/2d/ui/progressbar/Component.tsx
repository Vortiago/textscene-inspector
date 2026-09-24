/**
 * The native (WebGL canvas) painter for `ProgressBar`, after
 * `progress_bar.cpp:66-186`: the `background` StyleBox, the `fill` StyleBox
 * windowed to the ratio or the indeterminate frame, and the percentage label.
 * `ControlCanvasWalker` owns `visible`, the children and the transform.
 */
import { useMemo } from 'react';
import { CanvasItemGroup } from '../../../../r3f/components/CanvasItemGroup';
import type { NativeControlComponentProps } from '../../../../r3f/controls/ControlComponentRegistry';
import { painterView, controlLayoutOrder } from '../../../../r3f/controls/native/solveTree';
import { multiplyModulate } from '../../../../r3f/canvasItemModulate';
import { StyleBoxQuad } from '../../../../r3f/controls/native/StyleBoxQuad';
import { useControlClipPlanes } from '../../../../r3f/controls/native/controlClipping';
import { contentMarginSize } from '../../../../r3f/controls/native/styleBoxFlat';
import { TextRun } from '../../../../r3f/controls/native/text/TextRun';
import { AutowrapMode, shapeText, shapedTextSizeWidthPx } from '../../../../r3f/controls/native/text/textLayout';
import { isCanvasFontMetrics } from '../../../../r3f/controls/native/text/runtimeFontMetrics';
import { resolveNodeFontMetrics } from '../../../../r3f/controls/native/text/resolveNodeFontMetrics';
// A 2D Control outlines text through the same TextServer path as Label3D.
// `outlineRadiusPx` is the outward-only expansion for `<TextRun>`'s
// `outlineWidthPx`. `outlineStrokeWidthPx` is the centred canvas stroke width.
import { outlineRadiusPx, outlineStrokeWidthPx } from '../../../3d/label3d/glyphLayout';
import { rangeRatio } from '../shared/range';
import {
  progressBarDefaultBackground,
  progressBarDefaultFill,
  progressBarFillRect,
  progressBarIndeterminateFillRect,
  progressBarOutlineColor,
  progressBarOutlineSize,
  progressBarPercentRatio,
  progressBarTextTheme,
  PROGRESS_BAR_THEME_FONT_KEY,
} from './nativeSolver';
import type { ProgressBarProperties } from './types';

export function ProgressBar({ solveNode, tint, rect, theme, renderOrder }: NativeControlComponentProps) {
  const props = painterView<ProgressBarProperties>(solveNode);
  const clippingPlanes = useControlClipPlanes();

  const backgroundBox = solveNode.styleBoxes.background ?? progressBarDefaultBackground(theme);
  const fillBox = solveNode.styleBoxes.fill ?? progressBarDefaultFill(theme);

  const size = { x: rect.w, y: rect.h };
  const indeterminate = props.indeterminate === true;
  const orderedKeys = controlLayoutOrder(solveNode);

  const fillRect = indeterminate
    ? progressBarIndeterminateFillRect(size, props.fillMode, solveNode.rtl)
    : progressBarFillRect(size, props.fillMode, rangeRatio(props, orderedKeys), contentMarginSize(fillBox), solveNode.rtl);

  // `progress_bar.cpp:109`: the indeterminate branch returns before the
  // percentage block, whatever `show_percentage` says.
  const showPercentage = !indeterminate && (props.showPercentage ?? true);

  const { fontSizePx, color: fontColorSrgb } = progressBarTextTheme(solveNode, props, { theme });
  const outlineColorSrgb = progressBarOutlineColor(solveNode.colors);
  const outlineSize = progressBarOutlineSize(solveNode.constants);
  const fontMetrics = resolveNodeFontMetrics(solveNode, PROGRESS_BAR_THEME_FONT_KEY);

  const percentText = showPercentage
    ? `${Math.round(progressBarPercentRatio(props, orderedKeys) * 100)}%`
    : null;

  const layout = useMemo(() => {
    if (!percentText) return null;
    return shapeText(percentText, {
      fontSizePx,
      boxWidthPx: 0,
      autowrapMode: AutowrapMode.OFF,
      lineSpacingPx: 0,
      fontMetrics,
    });
  }, [percentText, fontSizePx, fontMetrics]);

  const textPos = useMemo(() => {
    if (!layout) return null;
    // `Point2((size.width - tl.width) / 2, (size.height - tl.height) / 2).round()`
    // (`progress_bar.cpp:178`): the box top, not the baseline.
    const w = shapedTextSizeWidthPx(layout.widthPx);
    return {
      x: Math.round((size.x - w) / 2),
      y: Math.round((size.y - layout.heightPx) / 2),
    };
  }, [layout, size.x, size.y]);

  // `tint.own` is raw sRGB: each `<StyleBoxQuad>` takes it as is, and it
  // multiplies into the font and outline colours before their one linear conversion.
  const tintedFontColor = useMemo(() => multiplyModulate(fontColorSrgb, tint.own), [fontColorSrgb, tint.own]);
  const tintedOutlineColor = useMemo(() => multiplyModulate(outlineColorSrgb, tint.own), [outlineColorSrgb, tint.own]);

  // `progress_bar.cpp:180`: `font_outline_size > 0 && font_outline_color.a > 0`.
  const hasOutline = outlineSize > 0 && outlineColorSrgb.a > 0 && layout !== null;
  // The MSDF atlas, the default font, has no contour to stroke: it composites
  // a second, wider fill threshold in the same mesh.
  const drawCanvasOutline = hasOutline && isCanvasFontMetrics(layout.fontMetrics);
  const drawMsdfOutline = hasOutline && !isCanvasFontMetrics(layout.fontMetrics);

  return (
    <>
      <StyleBoxQuad styleBox={backgroundBox} color={tint.own} rect={rect} renderOrder={renderOrder} />
      {fillRect && (
        <CanvasItemGroup position={[fillRect.x, -fillRect.y, 0]}>
          <StyleBoxQuad
            styleBox={fillBox}
            color={tint.own}
            rect={{ x: 0, y: 0, w: fillRect.w, h: fillRect.h }}
            renderOrder={renderOrder}
          />
        </CanvasItemGroup>
      )}
      {layout && textPos && (
        <CanvasItemGroup position={[textPos.x, -textPos.y, 0]}>
          {drawCanvasOutline && (
            <TextRun
              layout={layout}
              fontSizePx={fontSizePx}
              tint={tintedOutlineColor}
              strokeWidthPx={outlineStrokeWidthPx(outlineSize)}
              clippingPlanes={clippingPlanes}
              renderOrder={renderOrder}
            />
          )}
          <TextRun
            layout={layout}
            fontSizePx={fontSizePx}
            tint={tintedFontColor}
            outlineColor={drawMsdfOutline ? tintedOutlineColor : undefined}
            outlineWidthPx={drawMsdfOutline ? outlineRadiusPx(outlineSize) : 0}
            clippingPlanes={clippingPlanes}
            renderOrder={renderOrder}
          />
        </CanvasItemGroup>
      )}
    </>
  );
}
