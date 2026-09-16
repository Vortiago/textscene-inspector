/**
 * `<CodeEdit>` — the native (WebGL canvas) painter for `CodeEdit`: renders
 * `<TextEditBody>` (`../textedit/Component.tsx`) for the chrome/text/
 * highlight/glyph-icon half — identical to TextEdit's own, since
 * `CodeEdit::get_minimum_size` and its `NOTIFICATION_DRAW` row loop are both
 * TextEdit's, unchanged — with this node's OWN gutter band folded in so the
 * text shifts right to make room, then draws the ONE gutter this previewer
 * paints on top: the line-numbers column (`nativeSolver.ts`'s own doc for
 * why the main/fold gutters reserve width but draw nothing).
 *
 * SYNTAX HIGHLIGHTING, `syntax_highlighter`'s `CodeHighlighter` colour data,
 * and `indent_size`'s effect on a tab's rendered width, are both applied by
 * `<TextEditBody>` itself (`../textedit/Component.tsx`,
 * `resources/styles/codehighlighter/`) — this painter passes `indentSize`
 * through as `tabSize` and otherwise defers entirely.
 *
 * This component never checks `props.visible`, never renders `children`, and
 * never applies a transform — all three are `ControlCanvasWalker`'s job.
 */
import { useMemo } from 'react';
import { CanvasItemGroup } from '../../../../r3f/components/CanvasItemGroup';
import type { NativeControlComponentProps } from '../../../../r3f/controls/ControlComponentRegistry';
import { painterView } from '../../../../r3f/controls/native/solveTree';
import { useWorldClipPlanes } from '../../../../r3f/controls/native/controlClipping';
import { multiplyModulate } from '../../../../r3f/canvasItemModulate';
import { TextRun } from '../../../../r3f/controls/native/text/TextRun';
import { AutowrapMode, shapeText } from '../../../../r3f/controls/native/text/textLayout';
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
  TEXT_EDIT_THEME_FONT_KEY,
} from '../textedit/nativeSolver';
import {
  codeEditGutterBand,
  codeEditLineNumberText,
  codeEditLineNumberGutterXPx,
  codeEditGutterCellTextTopPx,
  CODE_EDIT_LINE_NUMBER_COLOR,
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

  // Buffer-line start rows — line numbers draw once per buffer line, on its
  // FIRST wrapped row only (text_edit.cpp:1410: `if (line_wrap_index == 0)`).
  // Shaped at the SAME wrap width `<TextEditBody>` uses internally (its own
  // `gutterBandWidthPx` is this node's `band.totalWidthPx`, handed down two
  // lines below) — otherwise a wrapped CodeEdit's row count here would
  // disagree with the rows `<TextEditBody>` actually draws, and every line
  // number past the first would sit beside the wrong row.
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
        tabStopsPx
      ),
    [lines, fontSizePx, codeEditProps.wrapMode, codeEditProps.autowrapMode, wrapWidthPx, fontMetrics, tabStopsPx]
  );

  const lineNumberGutterXPx = codeEditLineNumberGutterXPx(styleBox.contentMargin.left, band.mainWidthPx);

  const { anchorRef, clippingPlanes } = useWorldClipPlanes(rect);

  return (
    <CanvasItemGroup ref={anchorRef}>
      <TextEditBody {...props} gutterBandWidthPx={band.totalWidthPx} tabSize={codeEditProps.indentSize} />
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
          const rowTopPx = startRow * rowHeightPx;
          const textTopPx = codeEditGutterCellTextTopPx(rowTopPx, rowHeightPx, layout.heightPx);
          return (
            <CanvasItemGroup key={lineIndex} position={[lineNumberGutterXPx, -textTopPx, 0]}>
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
