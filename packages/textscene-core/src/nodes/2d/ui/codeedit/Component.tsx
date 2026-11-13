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
import { multiplyModulate, useItemLinearColorOf } from '../../../../r3f/canvasItemModulate';
import { TextRun } from '../../../../r3f/controls/native/text/TextRun';
import { shapeText } from '../../../../r3f/controls/native/text/textLayout';
import { useNodeIcon } from '../../../../r3f/controls/native/useIconTexture';
import { CODE_EDIT_FOLD_ICONS } from '../../../../r3f/controls/native/themeIcons';
import { ControlQuad as FoldQuad } from '../../../../r3f/controls/native/controlQuad';
import { useControlBidiOptions } from '../../../../r3f/controls/native/text/useControlBidiOptions';
import { resolveNodeFontMetrics } from '../../../../r3f/controls/native/text/resolveNodeFontMetrics';
import { TextEditBody } from '../textedit/Component';
import { useTextEditRows } from '../textedit/useTextEditRows';
import { internalScrollBarBoxes } from '../shared/scrollBarBoxes';
import {
  resolveTextEditStyleState,
  textEditTextTheme,
  textEditRowHeightPx,
  textEditDrawnLines,
  textEditTabStopsPx,
  textEditRowBandTopPx,
  layoutTextEditDrawBand,
  TEXT_EDIT_DEFAULT_TAB_SIZE,
  TEXT_EDIT_THEME_FONT_KEY,
  textEditLineSpacingPx,
  textEditWrapOffsetPx,
} from '../textedit/nativeSolver';
import { buildFoldContext, canFoldLine, isLineCodeRegionStart } from './lineFolding';
import {
  codeEditGutterBand,
  codeEditFoldGutterXPx,
  codeEditFoldIconRect,
  codeEditRegionIconColor,
  codeEditLineNumberText,
  codeEditLineNumberGutterXPx,
  codeEditLineNumberTextXPx,
  codeEditGutterCellTextTopPx,
  codeEditGuidelines,
} from './nativeSolver';
import type { CodeEditProperties } from './types';
import { AutowrapMode } from '../../../../godot/text/textServerEnums';
import { requiredThemeItem } from '../../../../r3f/controls/native/themeItems';

export function CodeEdit(props: NativeControlComponentProps) {
  const { solveNode, childTint, rect, renderOrder, measureText } = props;
  const toItemLinear = useItemLinearColorOf();
  const codeEditProps = painterView<CodeEditProperties>(solveNode);
  const state = resolveTextEditStyleState(codeEditProps.editable);
  const styleBox = requiredThemeItem(solveNode.styleBoxes, state);

  const { fontSizePx } = textEditTextTheme(solveNode, codeEditProps, state);
  const fontMetrics = resolveNodeFontMetrics(solveNode, TEXT_EDIT_THEME_FONT_KEY);
  const lineSpacingPx = textEditLineSpacingPx(solveNode);
  const rowHeightPx = textEditRowHeightPx(fontMetrics, fontSizePx, lineSpacingPx);

  const lines = useMemo(() => (codeEditProps.text ?? '').split('\n'), [codeEditProps.text]);
  const charWidth0Px = measureText ? measureText('0', fontSizePx, 0, fontMetrics).x : 0;
  const band = useMemo(
    () => codeEditGutterBand(codeEditProps, rowHeightPx, charWidth0Px, Math.max(1, lines.length)),
    [codeEditProps, rowHeightPx, charWidth0Px, lines.length]
  );

  const lineNumberColor = requiredThemeItem(solveNode.colors, 'line_number_color');
  const lineNumberColorTinted = useMemo(
    () => multiplyModulate(childTint.own, lineNumberColor),
    [childTint.own, lineNumberColor]
  );

  // Line numbers draw once per buffer line, on its first wrapped row (text_edit.cpp:1410).
  // The rows are shaped as `<TextEditBody>` shapes them, wrap width and scroll bar included, or each
  // number past the first sits beside the wrong row.
  const drawn = useMemo(
    () => textEditDrawnLines(codeEditProps.text, codeEditProps.placeholderText),
    [codeEditProps.text, codeEditProps.placeholderText]
  );
  const tabStopsPx = useMemo(
    () => textEditTabStopsPx(codeEditProps.indentSize, fontMetrics, fontSizePx),
    [codeEditProps.indentSize, fontMetrics, fontSizePx]
  );
  const bidi = useControlBidiOptions(codeEditProps, solveNode);
  const rows = useTextEditRows({
    lines: drawn.lines,
    isPlaceholder: drawn.isPlaceholder,
    size: { x: rect.w, y: rect.h },
    margins: styleBox.contentMargin,
    rowHeightPx,
    gutterBandWidthPx: band.totalWidthPx,
    minimapWidthPx: codeEditProps.minimapWidth ?? 80,
    drawMinimap: codeEditProps.minimapDraw,
    wrapOffsetPx: textEditWrapOffsetPx(solveNode),
    scrollPastEndOfFile: codeEditProps.scrollPastEndOfFile === true,
    fitContentHeight: codeEditProps.fitContentHeight === true,
    rtl: solveNode.rtl,
    shape: {
      fontSizePx,
      fontMetrics,
      wrapMode: codeEditProps.wrapMode,
      autowrapMode: codeEditProps.autowrapMode,
      tabStopsPx,
      preserveControl: codeEditProps.drawControlChars,
      indentWrappedLines: codeEditProps.indentWrappedLines,
      bidi,
    },
    scrollBarBoxes: internalScrollBarBoxes(solveNode),
  });
  // A placeholder paragraph replaces the buffer's single empty line, which starts at row 0.
  const { lineLayouts } = rows;
  const lineStartRows = useMemo(
    () => (drawn.isPlaceholder ? [0] : lineLayouts.map(({ startRow }) => startRow)),
    [drawn.isPlaceholder, lineLayouts]
  );

  const numerals = { locale: solveNode.locale, localizeNumeralSystem: codeEditProps.localizeNumeralSystem };
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
    [
      codeEditProps.lineLengthGuidelines,
      fontSizePx,
      fontMetrics,
      drawBand.xMarginBeginPx,
      drawBand.xMarginEndPx,
      rect.w,
      solveNode.rtl,
    ]
  );
  const baseGuidelineColor = requiredThemeItem(solveNode.colors, 'line_length_guideline_color');
  const guidelineColor = useMemo(
    () => multiplyModulate(childTint.own, baseGuidelineColor),
    [childTint.own, baseGuidelineColor]
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
  const foldingColor = requiredThemeItem(solveNode.colors, 'code_folding_color');
  const foldArrowColor = useMemo(
    () => multiplyModulate(childTint.own, foldingColor),
    [childTint.own, foldingColor]
  );
  const foldRegionColor = useMemo(
    () => multiplyModulate(childTint.own, codeEditRegionIconColor(solveNode.colors)),
    [childTint.own, solveNode.colors]
  );
  const canFoldIcon = useNodeIcon(
    solveNode.icons.can_fold,
    band.foldDrawn ? CODE_EDIT_FOLD_ICONS.canFold : null
  );
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
        rows={rows}
        tabSize={codeEditProps.indentSize}
        underlay={guidelines.map((guideline, i) => (
          <CanvasItemGroup key={i} position={[guideline.xPx, 0, 0]}>
            <ControlQuad
              width={1}
              height={rect.h}
              color={toItemLinear(guidelineColor)}
              opacity={guideline.dimmed ? guidelineColor.a * 0.5 : guidelineColor.a}
              renderOrder={renderOrder}
            />
          </CanvasItemGroup>
        ))}
      />
      {band.foldDrawn &&
        canFoldIcon &&
        canFoldRegionIcon &&
        lineStartRows.map((startRow, lineIndex) => {
          if (!canFoldLine(foldContext, lineIndex, codeEditProps.lineFolding === true)) return null;
          const region = isLineCodeRegionStart(foldContext, lineIndex);
          const icon = codeEditFoldIconRect({
            x: foldGutterXPx,
            y: textEditRowBandTopPx(startRow, rowHeightPx, styleBox.contentMargin.top, lineSpacingPx),
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
                color={toItemLinear(color)}
                opacity={color.a}
                map={region ? canFoldRegionIcon : canFoldIcon}
              />
            </CanvasItemGroup>
          );
        })}
      {band.lineNumbersDrawn &&
        lineStartRows.map((startRow, lineIndex) => {
          const text = codeEditLineNumberText(
            lineIndex,
            band.lineNumberDigits,
            codeEditProps.gutterZeroPadLineNumbers,
            numerals
          );
          const layout = shapeText(text, {
            fontSizePx,
            boxWidthPx: 0,
            autowrapMode: AutowrapMode.AUTOWRAP_OFF,
            lineSpacingPx: 0,
            fontMetrics,
            language: solveNode.locale,
          });
          // The gutter cell is the row's own band (`text_edit.cpp:1448`), so
          // it starts where the band does, not at the control's top edge.
          const rowTopPx = textEditRowBandTopPx(
            startRow,
            rowHeightPx,
            styleBox.contentMargin.top,
            lineSpacingPx
          );
          const textTopPx = codeEditGutterCellTextTopPx(rowTopPx, rowHeightPx, layout.heightPx);
          return (
            <CanvasItemGroup
              key={lineIndex}
              position={[
                codeEditLineNumberTextXPx(
                  lineNumberGutterXPx,
                  band.lineNumberWidthPx,
                  rect.w,
                  layout.widthPx,
                  solveNode.rtl
                ),
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
