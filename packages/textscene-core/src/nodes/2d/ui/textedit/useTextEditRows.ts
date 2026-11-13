import { useMemo } from 'react';
import { solveTextEditRows, type TextEditRows } from './rows';

type TextEditRowsInput = Parameters<typeof solveTextEditRows>[0];

/**
 * `solveTextEditRows` memoised on the fields it reads. A caller builds `input` fresh each render,
 * which a memo on `input` itself would miss. A caller that already solved the rows passes them as `solved`,
 * so a painter nested in another shapes the buffer once.
 */
export function useTextEditRows(input: TextEditRowsInput, solved?: TextEditRows): TextEditRows {
  const { lines, isPlaceholder, rowHeightPx, gutterBandWidthPx, minimapWidthPx, drawMinimap } = input;
  const { scrollPastEndOfFile, fitContentHeight, rtl, theme } = input;
  const { x: width, y: height } = input.size;
  const { left, top, right, bottom } = input.margins;
  const { fontSizePx, fontMetrics, wrapMode, autowrapMode, tabStopsPx } = input.shape;
  const { preserveControl, indentWrappedLines, bidi } = input.shape;
  return useMemo(
    () =>
      solved ??
      solveTextEditRows({
        lines,
        isPlaceholder,
        size: { x: width, y: height },
        margins: { left, top, right, bottom },
        rowHeightPx,
        gutterBandWidthPx,
        minimapWidthPx,
        drawMinimap,
        scrollPastEndOfFile,
        fitContentHeight,
        rtl,
        shape: {
          fontSizePx,
          fontMetrics,
          wrapMode,
          autowrapMode,
          tabStopsPx,
          preserveControl,
          indentWrappedLines,
          bidi,
        },
        theme,
      }),
    [
      lines,
      isPlaceholder,
      width,
      height,
      left,
      top,
      right,
      bottom,
      rowHeightPx,
      gutterBandWidthPx,
      minimapWidthPx,
      drawMinimap,
      scrollPastEndOfFile,
      fitContentHeight,
      rtl,
      fontSizePx,
      fontMetrics,
      wrapMode,
      autowrapMode,
      tabStopsPx,
      preserveControl,
      indentWrappedLines,
      bidi,
      theme,
      solved,
    ]
  );
}
