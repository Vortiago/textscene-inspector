/**
 * `<CodeEdit>`, the native (WebGL canvas) painter. `<TextEditBody>` draws the chrome, text, syntax
 * highlighting and tab width, since the minimum size and draw loop are TextEdit's. This adds the
 * gutter band that shifts the text, the line numbers, the `line_length_guidelines` under the text
 * (`text_edit.cpp:1319-1322`) and the fold arrows (`lineFolding.ts`).
 */
import { useMemo } from 'react';
import { CanvasItemGroup } from '../../../../r3f/components/CanvasItemGroup';
import type { NativeControlComponentProps } from '../../../../r3f/controls/ControlComponentRegistry';
import { painterView } from '../../../../r3f/controls/native/solveTree';
import { useWorldClipPlanes } from '../../../../r3f/controls/native/controlClipping';
import { ControlQuad } from '../../../../r3f/controls/native/controlQuad';
import { godotColorToLinear } from '../../../../r3f/godotColor';
import { multiplyModulate } from '../../../../r3f/canvasItemModulate';
import { TextRun } from '../../../../r3f/controls/native/text/TextRun';
import { AutowrapMode, shapeText } from '../../../../r3f/controls/native/text/textLayout';
import { useNodeIcon } from '../../../../r3f/controls/native/useIconTexture';
import { CODE_EDIT_FOLD_ICONS } from '../../../../r3f/controls/native/themeIcons';
import { ControlQuad as FoldQuad } from '../../../../r3f/controls/native/controlQuad';
import { resolveNodeFontMetrics } from '../../../../r3f/controls/native/text/resolveNodeFontMetrics';
import { TextEditBody } from '../textedit/Component';
import {
  pickTextEditStyleBox,
  resolveTextEditStyleState,
  textEditTextTheme,
  textEditRowHeightPx,
  textEditWrapWidthPx,
  shapeTextEditLines,
  textEditTabStopsPx,
  textEditRowBandTopPx,
  layoutTextEditDrawBand,
  TEXT_EDIT_DEFAULT_TAB_SIZE,
  TEXT_EDIT_THEME_FONT_KEY,
} from '../textedit/nativeSolver';
import { buildFoldContext, canFoldLine, isLineCodeRegionStart } from './lineFolding';
import {
  codeEditGutterBand,
  codeEditFoldGutterXPx,
  codeEditFoldIconRect,
  CODE_EDIT_CODE_FOLDING_COLOR,
  CODE_EDIT_CODE_REGION_ICON_COLOR,
  codeEditLineNumberText,
  codeEditLineNumberGutterXPx,
  codeEditLineNumberTextXPx,
  codeEditGutterCellTextTopPx,
  codeEditGuidelines,
  CODE_EDIT_LINE_NUMBER_COLOR,
  CODE_EDIT_LINE_LENGTH_GUIDELINE_COLOR,
} from './nativeSolver';
import type { CodeEditProperties } from './types';

export function CodeEdit(props: NativeControlComponentProps) {
  const { solveNode, tint, rect, renderOrder, theme, measureText } = props;
  const codeEditProps = painterView<CodeEditProperties>(solveNode);
  const state = resolveTextEditStyleState(codeEditProps.editable);
  const styleBox = pickTextEditStyleBox(solveNode.styleBoxes, theme.widgets.lineEdit, state);

  const { fontSizePx } = textEditTextTheme(solveNode, codeEditProps, state, { theme });
  const fontMetrics = resolveNodeFontMetrics(solveNode, TEXT_EDIT_THEME_FONT_KEY);
  const rowHeightPx = textEditRowHeightPx(fontMetrics, fontSizePx, theme.separation);

  const lines = useMemo(() => (codeEditProps.text ?? '').split('\n'), [codeEditProps.text]);
  const charWidth0Px = measureText ? measureText('0', fontSizePx, 0, fontMetrics).x : 0;
  const band = useMemo(
    () => codeEditGutterBand(codeEditProps, rowHeightPx, charWidth0Px, Math.max(1, lines.length)),
    [codeEditProps, rowHeightPx, charWidth0Px, lines.length]
  );

  const lineNumberColorTinted = useMemo(
    () => multiplyModulate(tint.own, CODE_EDIT_LINE_NUMBER_COLOR),
    [tint.own]
  );

  // Line numbers draw once per buffer line, on its first wrapped row (text_edit.cpp:1410).
  // The rows are shaped at `<TextEditBody>`'s wrap width, whose gutter band is
  // `band.totalWidthPx`, or each number past the first sits beside the wrong row.
  const wrapWidthPx = useMemo(
    () =>
      textEditWrapWidthPx(
        rect.w,
        styleBox.contentMargin.left + styleBox.contentMargin.right,
        band.totalWidthPx,
        codeEditProps.minimapWidth ?? 80,
        codeEditProps.minimapDraw
      ),
    [rect.w, styleBox, band.totalWidthPx, codeEditProps.minimapWidth, codeEditProps.minimapDraw]
  );
  const tabStopsPx = useMemo(
    () => textEditTabStopsPx(codeEditProps.indentSize, fontMetrics, fontSizePx),
    [codeEditProps.indentSize, fontMetrics, fontSizePx]
  );
  const lineLayouts = useMemo(
    () =>
      shapeTextEditLines(
        lines,
        fontSizePx,
        codeEditProps.wrapMode,
        codeEditProps.autowrapMode,
        wrapWidthPx,
        fontMetrics,
        tabStopsPx,
        codeEditProps.drawControlChars,
        codeEditProps.indentWrappedLines
      ),
    [
      lines,
      fontSizePx,
      codeEditProps.wrapMode,
      codeEditProps.autowrapMode,
      wrapWidthPx,
      fontMetrics,
      tabStopsPx,
      codeEditProps.drawControlChars,
      codeEditProps.indentWrappedLines,
    ]
  );

  const lineNumberGutterXPx = codeEditLineNumberGutterXPx(styleBox.contentMargin.left, band.mainWidthPx);

  const drawBand = layoutTextEditDrawBand(
    rect.w,
    styleBox,
    band.totalWidthPx,
    codeEditProps.minimapWidth ?? 80,
    codeEditProps.minimapDraw,
    rowHeightPx
  );
  const guidelines = useMemo(
    () =>
      codeEditGuidelines(
        codeEditProps.lineLengthGuidelines ?? [],
        (column) => (measureText ? measureText('0'.repeat(column), fontSizePx, 0, fontMetrics).x : 0),
        drawBand.xMarginBeginPx,
        drawBand.xMarginEndPx,
        rect.w,
        solveNode.rtl
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [codeEditProps.lineLengthGuidelines, fontSizePx, fontMetrics, drawBand.xMarginBeginPx, drawBand.xMarginEndPx, rect.w, solveNode.rtl]
  );
  const guidelineColor = useMemo(
    () => multiplyModulate(tint.own, CODE_EDIT_LINE_LENGTH_GUIDELINE_COLOR),
    [tint.own]
  );

  const foldContext = useMemo(
    () =>
      buildFoldContext(
        lines,
        codeEditProps.delimiterComments,
        codeEditProps.delimiterStrings,
        codeEditProps.indentSize ?? TEXT_EDIT_DEFAULT_TAB_SIZE
      ),
    [lines, codeEditProps.delimiterComments, codeEditProps.delimiterStrings, codeEditProps.indentSize]
  );
  const foldGutterXPx = codeEditFoldGutterXPx(
    styleBox.contentMargin.left,
    band.mainWidthPx,
    band.lineNumberWidthPx
  );
  const foldArrowColor = useMemo(() => multiplyModulate(tint.own, CODE_EDIT_CODE_FOLDING_COLOR), [tint.own]);
  const foldRegionColor = useMemo(
    () => multiplyModulate(tint.own, CODE_EDIT_CODE_REGION_ICON_COLOR),
    [tint.own]
  );
  const canFoldIcon = useNodeIcon(solveNode.icons.can_fold, band.foldDrawn ? CODE_EDIT_FOLD_ICONS.canFold : null);
  const canFoldRegionIcon = useNodeIcon(
    solveNode.icons.can_fold_code_region,
    band.foldDrawn ? CODE_EDIT_FOLD_ICONS.canFoldCodeRegion : null
  );

  // Local, not `rect`: `../textedit/Component.tsx`'s `ownRect` doc gives the reason.
  const ownRect = useMemo(() => ({ x: 0, y: 0, w: rect.w, h: rect.h }), [rect.w, rect.h]);
  const { anchorRef, clippingPlanes } = useWorldClipPlanes(ownRect);

  // `ControlCanvasWalker` owns `visible`, the children and the transform.
  return (
    <CanvasItemGroup ref={anchorRef}>
      <TextEditBody
        {...props}
        gutterBandWidthPx={band.totalWidthPx}
        tabSize={codeEditProps.indentSize}
        underlay={guidelines.map((guideline, i) => (
          <CanvasItemGroup key={i} position={[guideline.xPx, 0, 0]}>
            <ControlQuad
              width={1}
              height={rect.h}
              color={godotColorToLinear(guidelineColor)}
              opacity={guideline.dimmed ? guidelineColor.a * 0.5 : guidelineColor.a}
              renderOrder={renderOrder}
            />
          </CanvasItemGroup>
        ))}
      />
      {band.foldDrawn &&
        canFoldIcon &&
        canFoldRegionIcon &&
        lineLayouts.map(({ startRow }, lineIndex) => {
          if (!canFoldLine(foldContext, lineIndex, codeEditProps.lineFolding === true)) return null;
          const region = isLineCodeRegionStart(foldContext, lineIndex);
          const icon = codeEditFoldIconRect({
            x: foldGutterXPx,
            y: textEditRowBandTopPx(startRow, rowHeightPx, styleBox.contentMargin.top, theme.separation),
            w: band.foldWidthPx,
            h: rowHeightPx,
          });
          const color = region ? foldRegionColor : foldArrowColor;
          return (
            <CanvasItemGroup key={`fold-${lineIndex}`} position={[icon.x, -icon.y, 0]}>
              <FoldQuad
                renderOrder={renderOrder}
                width={icon.w}
                height={icon.h}
                color={godotColorToLinear(color)}
                opacity={color.a}
                map={region ? canFoldRegionIcon : canFoldIcon}
              />
            </CanvasItemGroup>
          );
        })}
      {band.lineNumbersDrawn &&
        lineLayouts.map(({ startRow }, lineIndex) => {
          const text = codeEditLineNumberText(lineIndex, band.lineNumberDigits, codeEditProps.gutterZeroPadLineNumbers);
          const layout = shapeText(text, {
            fontSizePx,
            boxWidthPx: 0,
            autowrapMode: AutowrapMode.OFF,
            lineSpacingPx: 0,
            fontMetrics,
          });
          // The gutter cell is the row's own band (`text_edit.cpp:1448`), so
          // it starts where the band does, not at the control's top edge.
          const rowTopPx = textEditRowBandTopPx(startRow, rowHeightPx, styleBox.contentMargin.top, theme.separation);
          const textTopPx = codeEditGutterCellTextTopPx(rowTopPx, rowHeightPx, layout.heightPx);
          return (
            <CanvasItemGroup
              key={lineIndex}
              position={[
                codeEditLineNumberTextXPx(lineNumberGutterXPx, band.lineNumberWidthPx, rect.w, layout.widthPx, solveNode.rtl),
                -textTopPx,
                0,
              ]}
            >
              <TextRun
                layout={layout}
                fontSizePx={fontSizePx}
                tint={lineNumberColorTinted}
                clippingPlanes={clippingPlanes}
                renderOrder={renderOrder}
              />
            </CanvasItemGroup>
          );
        })}
    </CanvasItemGroup>
  );
}
