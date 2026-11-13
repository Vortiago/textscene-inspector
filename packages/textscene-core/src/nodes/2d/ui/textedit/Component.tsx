/**
 * `<TextEdit>`: the native (WebGL canvas) painter, a still frame of `_notification(NOTIFICATION_DRAW)`
 * (`text_edit.cpp:904-1942`) from line 0, column 0 (scrolling is inert, see nativeSolver.ts), with no
 * selection, brace match, word highlight, search box or IME. The minimap draws at scroll 0. `<CodeEdit>` renders
 * `<TextEditBody>` with its gutters. Visibility, children and transform are the walker's job.
 */

import { useMemo, type ReactNode } from 'react';
import { CanvasItemGroup } from '../../../../r3f/components/CanvasItemGroup';
import type { NativeControlComponentProps } from '../../../../r3f/controls/ControlComponentRegistry';
import { painterView } from '../../../../r3f/controls/native/solveTree';
import { StyleBoxQuad } from '../../../../r3f/controls/native/StyleBoxQuad';
import { ControlQuad } from '../../../../r3f/controls/native/controlQuad';
import { useWorldClipPlanes } from '../../../../r3f/controls/native/controlClipping';
import { useNodeIcon } from '../../../../r3f/controls/native/useIconTexture';
import { multiplyModulate, useItemLinearColorOf } from '../../../../r3f/canvasItemModulate';
import { ScrollBarChrome } from '../shared/ScrollChrome';
import { TextEditMinimap } from './TextEditMinimap';
import { textEditMinimapLines } from './minimap';
import { TextRun } from '../../../../r3f/controls/native/text/TextRun';
import { soloLineLayout } from '../../../../r3f/controls/native/text/textLayout';
import { useControlBidiOptions } from '../../../../r3f/controls/native/text/useControlBidiOptions';
import { resolveNodeFontMetrics } from '../../../../r3f/controls/native/text/resolveNodeFontMetrics';
import { useSubOrExtResource } from '../../../../resources/useSubOrExtResource';
import { decodeCodeHighlighter } from '../../../../resources/styles/codehighlighter/decode';
import {
  resolveLineColors,
  type CodeHighlighterColorSpan,
} from '../../../../resources/styles/codehighlighter/highlight';
import {
  textEditCaretRect,
  textEditWrapIndentPx,
  textEditFirstIndentRow,
  textEditRowBandTopPx,
  textEditRowTextTopPx,
  pickTextEditStyleBox,
  resolveTextEditStyleState,
  textEditTextTheme,
  textEditDrawnLines,
  textEditRowHeightPx,
  layoutTextEditDrawBand,
  textEditCurrentLineXPx,
  textEditRowOriginXPx,
  textEditRowStartIndices,
  textEditRowColorRuns,
  textEditDrawnGlyphs,
  textEditColorRunLine,
  textEditGlyphColorAt,
  textEditGlyphLineIndex,
  textEditTabStopsPx,
  TEXT_EDIT_THEME_FONT_KEY,
  TEXT_EDIT_DEFAULT_TAB_SIZE,
  TEXT_EDIT_DEFAULT_MINIMAP_WIDTH_PX,
  textEditCapSpanAlpha,
} from './nativeSolver';
import { useTextEditRows } from './useTextEditRows';
import { internalScrollBarBoxes } from '../shared/scrollBarBoxes';
import type { TextEditRows } from './rows';
import { scaledIconSize } from '../../../../r3f/controls/native/scaledSvgIcon';
import { TEXT_EDIT_GLYPH_ICONS } from '../../../../r3f/controls/native/themeIcons';
import type { TextEditProperties } from './types';
import { CONTROL_FONT_COLOR } from '../../../../godot/scene/theme';

/** `text_edit_tab.svg`/`text_edit_space.svg`'s authored size. The default theme rasterises both at the theme scale. */
const GLYPH_ICON_AUTHORED_SIZE_PX = 8;

/** `default_theme.cpp:472` (TextEdit) / `:518` (CodeEdit): the same literal for both. */
const CURRENT_LINE_COLOR = { r: 0.25, g: 0.25, b: 0.26, a: 0.8 };

/** The stand-in row for a buffer line with no shaped rows: an empty line measures no indent. */
const EMPTY_ROW = { text: '', glyphs: [], widthPx: 0, paragraphIndex: 0 };

/** `default_theme.cpp:481` (TextEdit) / `:527` (CodeEdit): `caret_width`, the same literal for both. Unscaled, like every constant here. */
const CARET_WIDTH_PX = 1;

/**
 * `caret_color`, the same for both types (`default_theme.cpp:473`, `:526`). Not
 * the state-dependent font colour: a read-only TextEdit paints its text at
 * `font_readonly_color` and its caret at this.
 */
const CARET_COLOR = CONTROL_FONT_COLOR;

interface TextEditBodyProps extends NativeControlComponentProps {
  /**
   * Drawn between the panel StyleBox and the row loop, in `_draw_guidelines`'s slot
   * (`text_edit.cpp:1319-1322`), a virtual only `CodeEdit` overrides. It is a prop
   * because the order of panel, underlay, current-line band and text matters.
   */
  underlay?: ReactNode;
  /**
   * `gutters_width + gutter_padding` combined: `CodeEdit`'s gutters, and 0 for a bare
   * `TextEdit`, whose gutters no `.tscn` populates. `textEditWrapWidthPx` says why the
   * two terms never pass apart.
   */
  gutterBandWidthPx?: number;
  /** `CodeEdit.indent_size`, forwarded to `TextEdit::set_tab_size` (`code_edit.cpp:908-920`). Absent for a bare `TextEdit`, which has no `.tscn` property for it (`textEditTabStopsPx`). */
  tabSize?: number;
  /** The rows a wrapping painter already solved, so the buffer shapes once. Absent: solved here. */
  rows?: TextEditRows;
}

export function TextEditBody({
  solveNode,
  tint,
  childTint,
  rect,
  renderOrder,
  slot,
  theme,
  snapToPixels,
  gutterBandWidthPx = 0,
  tabSize,
  underlay,
  rows: solvedRows,
}: TextEditBodyProps) {
  const props = painterView<TextEditProperties>(solveNode);
  const toItemLinear = useItemLinearColorOf();
  const glyphIconPx = scaledIconSize(GLYPH_ICON_AUTHORED_SIZE_PX, theme.scale);
  const state = resolveTextEditStyleState(props.editable);
  const styleBox = pickTextEditStyleBox(solveNode.styleBoxes, theme.widgets.lineEdit, state);

  // `_using_placeholder` swaps the buffer for `placeholder_text` and its colour whatever `editable` says (`:1350-1352`).
  const { lines, isPlaceholder } = useMemo(
    () => textEditDrawnLines(props.text, props.placeholderText),
    [props.text, props.placeholderText]
  );
  const { fontSizePx, color: baseFontColor } = textEditTextTheme(
    solveNode,
    props,
    isPlaceholder ? 'placeholder' : state
  );

  const fontMetrics = resolveNodeFontMetrics(solveNode, TEXT_EDIT_THEME_FONT_KEY);
  // The highlighter's plain colour is the theme `font_color` whatever `editable` says (`syntax_highlighter.cpp:421`).
  const highlighterFontColor = textEditTextTheme(solveNode, props, 'normal').color;
  const lineSpacingPx = theme.separation; // nativeSolver.ts says why.
  const rowHeightPx = textEditRowHeightPx(fontMetrics, fontSizePx, lineSpacingPx);

  // `minimap_draw`/`minimap_width` narrow the text band, and the minimap draws in the strip they
  // free. The scroll bars draw over the band and take no part of it (`:941-944`).
  const band = layoutTextEditDrawBand(
    rect.w,
    styleBox,
    gutterBandWidthPx,
    props.minimapWidth ?? TEXT_EDIT_DEFAULT_MINIMAP_WIDTH_PX,
    props.minimapDraw,
    rowHeightPx
  );

  // The step-in reads line 0 of the buffer, which is empty while a placeholder draws (`:1480-1483`).
  const indentsWrappedRows = props.indentWrappedLines && !isPlaceholder;
  const tabStopsPx = useMemo(
    () => textEditTabStopsPx(tabSize, fontMetrics, fontSizePx),
    [tabSize, fontMetrics, fontSizePx]
  );
  const bidi = useControlBidiOptions(props, solveNode);
  const scrollBarBoxes = internalScrollBarBoxes(solveNode);
  const { lineLayouts, wrapWidthPx, scrollBars } = useTextEditRows(
    {
      lines,
      isPlaceholder,
      size: { x: rect.w, y: rect.h },
      margins: styleBox.contentMargin,
      rowHeightPx,
      gutterBandWidthPx,
      minimapWidthPx: props.minimapWidth ?? TEXT_EDIT_DEFAULT_MINIMAP_WIDTH_PX,
      drawMinimap: props.minimapDraw,
      scrollPastEndOfFile: props.scrollPastEndOfFile === true,
      fitContentHeight: props.fitContentHeight === true,
      rtl: solveNode.rtl,
      shape: {
        fontSizePx,
        fontMetrics,
        wrapMode: props.wrapMode,
        autowrapMode: props.autowrapMode,
        tabStopsPx,
        preserveControl: props.drawControlChars,
        indentWrappedLines: props.indentWrappedLines,
        bidi,
      },
      scrollBarBoxes,
    },
    solvedRows
  );

  // `syntax_highlighter` resolves in this node's scope, never `useSceneResources()`. Only a
  // `CodeHighlighter` decodes: anything else leaves `highlighter` null, and lines paint at `font_color`.
  // A placeholder paints at its own colour: the colour map of the empty buffer line is empty (`:1346-1352`).
  const highlighterResource = useSubOrExtResource(props.syntaxHighlighter, solveNode.resources)?.resource;
  const highlighter = useMemo(
    () =>
      highlighterResource?.type === 'CodeHighlighter'
        ? decodeCodeHighlighter(highlighterResource.data)
        : null,
    [highlighterResource]
  );
  // Threaded line by line: one open region (an unterminated string or comment)
  // carries into the next line (`highlight.ts`).
  const lineColorSpans = useMemo<(readonly CodeHighlighterColorSpan[])[] | null>(() => {
    if (!highlighter || isPlaceholder) return null;
    let region = -1;
    return lines.map((lineText) => {
      const { spans, regionAtLineEnd } = resolveLineColors(
        lineText,
        highlighter,
        highlighterFontColor,
        region
      );
      region = regionAtLineEnd;
      return props.editable === false ? textEditCapSpanAlpha(spans, baseFontColor.a) : spans;
    });
  }, [highlighter, isPlaceholder, lines, highlighterFontColor, baseFontColor.a, props.editable]);

  const minimapInput = useMemo(() => {
    if (!props.minimapDraw) return null;
    return {
      ...textEditMinimapLines(lines, lineLayouts, lineColorSpans, isPlaceholder),
      sizeWidthPx: rect.w,
      xMarginEndPx: band.xMarginEndPx,
      widthPx: props.minimapWidth ?? TEXT_EDIT_DEFAULT_MINIMAP_WIDTH_PX,
      rtl: solveNode.rtl,
      controlHeightPx: scrollBars.controlHeightPx,
      rowHeightPx,
      wrapWidthPx,
      tabSize: tabSize ?? TEXT_EDIT_DEFAULT_TAB_SIZE,
      indentWrappedLines: props.indentWrappedLines === true,
      highlightCurrentLine: props.highlightCurrentLine === true,
      editable: props.editable !== false,
      // The buffer's colour, not the placeholder's (`:1194`).
      fontColor: textEditTextTheme(solveNode, props, state).color,
      caretColor: solveNode.colors.caret_color ?? CARET_COLOR,
      currentLineColor: CURRENT_LINE_COLOR,
    };
  }, [
    props,
    solveNode,
    state,
    lines,
    lineLayouts,
    lineColorSpans,
    isPlaceholder,
    rect.w,
    band.xMarginEndPx,
    scrollBars.controlHeightPx,
    rowHeightPx,
    wrapWidthPx,
    tabSize,
  ]);

  // `tint.own` (raw sRGB, `self_modulate` folded onto `modulate`) tints the box alone
  // (`text_edit.cpp:915,949`). Everything else is drawn on the child item `text_ci` or by a child
  // scroll bar (`:9284-9292`), so it takes `childTint`, before its one sRGB-to-linear conversion.
  const tintedCurrentLineColor = useMemo(
    () => multiplyModulate(childTint.own, CURRENT_LINE_COLOR),
    [childTint.own]
  );
  const caretColor = solveNode.colors.caret_color ?? CARET_COLOR;
  const tintedCaretColor = useMemo(
    () => multiplyModulate(childTint.own, caretColor),
    [childTint.own, caretColor]
  );

  // `text_edit.cpp:1376-1378,1626`: every row starts below the stylebox's top
  // margin, and its text centres in the band that follows.
  const textHeightPx = rowHeightPx - lineSpacingPx;
  const rowBandTopPx = (row: number) =>
    textEditRowBandTopPx(row, rowHeightPx, styleBox.contentMargin.top, lineSpacingPx);
  // `draw_caret` clears for an unfocused node (`:926-927`), then takes
  // `caret_draw_when_editable_disabled` while `!editable` (`:945-947`): the only caret in a
  // frame without focus. Caret 0 rests at line 0, column 0, which a `.tscn` cannot move.
  const caretRect = textEditCaretRect(
    props.editable !== false,
    props.caretDrawWhenEditableDisabled === true,
    band.xMarginBeginPx,
    rowBandTopPx(0),
    rowHeightPx,
    textHeightPx,
    CARET_WIDTH_PX
  );

  // `text_ci` clips to the whole node rect (`:932-936`), not the content rect as LineEdit does.
  // Local, not `rect`: `useWorldClipPlanes` composes it with the anchor's world matrix, so a
  // rect carrying the control's offset clips the text at twice that offset.
  const ownRect = useMemo(() => ({ x: 0, y: 0, w: rect.w, h: rect.h }), [rect.w, rect.h]);
  const { anchorRef, clippingPlanes } = useWorldClipPlanes(ownRect);

  // Godot's `yofs`/`xofs` (`text_edit.cpp:1711-1718`) use a `line_ascent` the row model does
  // not carry, so each icon centres in its row band. A tab icon sits at its pen x and a space
  // icon centres on its advance, both as in Godot.
  const tabIcon = useNodeIcon(solveNode.icons.tab, TEXT_EDIT_GLYPH_ICONS.tab);
  const spaceIcon = useNodeIcon(solveNode.icons.space, TEXT_EDIT_GLYPH_ICONS.space);

  return (
    <CanvasItemGroup ref={anchorRef}>
      <StyleBoxQuad styleBox={styleBox} color={tint.own} rect={rect} renderOrder={renderOrder} />
      {minimapInput && (
        <TextEditMinimap input={minimapInput} tint={childTint.own} renderOrder={renderOrder} />
      )}
      {underlay}
      {props.highlightCurrentLine && (
        <CanvasItemGroup
          position={[textEditCurrentLineXPx(band.xMarginEndPx, rect.w, solveNode.rtl), -rowBandTopPx(0), 0]}
        >
          <ControlQuad
            width={band.xMarginEndPx}
            height={rowHeightPx}
            color={toItemLinear(tintedCurrentLineColor)}
            opacity={tintedCurrentLineColor.a}
            renderOrder={renderOrder}
          />
        </CanvasItemGroup>
      )}
      {caretRect && (
        <CanvasItemGroup position={[caretRect.x, -caretRect.y, 0]}>
          <ControlQuad
            width={caretRect.w}
            height={caretRect.h}
            color={toItemLinear(tintedCaretColor)}
            opacity={tintedCaretColor.a}
            renderOrder={renderOrder}
          />
        </CanvasItemGroup>
      )}
      {lineLayouts.map(({ layout, startRow }, lineIndex) => {
        const lineText = lines[lineIndex] ?? '';
        const spans = lineColorSpans?.[lineIndex];
        // Computed whenever the wrap indent or the highlighter's spans need it.
        const rowStartIndices =
          spans || indentsWrappedRows ? textEditRowStartIndices(lineText, layout.lines) : undefined;
        const wrapIndentPx = indentsWrappedRows
          ? textEditWrapIndentPx(layout.lines[0] ?? EMPTY_ROW, lineText, wrapWidthPx)
          : 0;
        const firstIndentRow = indentsWrappedRows
          ? textEditFirstIndentRow(lineText, rowStartIndices ?? [0])
          : 0;
        return layout.lines.map((line, rowInLine) => {
          const row = startRow + rowInLine;
          const rowTopPx = textEditRowTextTopPx(rowBandTopPx(row), rowHeightPx, textHeightPx);
          const rowStartIndex = rowStartIndices?.[rowInLine] ?? 0;
          const rowOriginXPx = textEditRowOriginXPx(
            band.xMarginBeginPx,
            rect.w,
            line.widthPx,
            solveNode.rtl,
            rowInLine > firstIndentRow ? wrapIndentPx : 0
          );
          // Godot drops each glyph that crosses a margin and stops walking at the end one (`:1724-1738`).
          const drawn = textEditDrawnGlyphs(
            line.glyphs,
            rowOriginXPx,
            band.xMarginBeginPx,
            band.xMarginEndPx
          );
          const runs = textEditRowColorRuns(line.glyphs, rowStartIndex, spans, baseFontColor, drawn);
          return (
            <CanvasItemGroup key={`${lineIndex}-${rowInLine}`} position={[rowOriginXPx, -rowTopPx, 0]}>
              {runs.map((run, runIndex) => (
                <TextRun
                  key={runIndex}
                  layout={soloLineLayout(textEditColorRunLine(run), layout)}
                  fontSizePx={fontSizePx}
                  tint={multiplyModulate(childTint.own, run.color)}
                  clippingPlanes={clippingPlanes}
                  renderOrder={renderOrder}
                />
              ))}
              {(props.drawTabs || props.drawSpaces) &&
                line.glyphs.map((glyph, glyphIndex) => {
                  // The icons draw before the margin test, but only for a glyph the walk reaches.
                  if (glyphIndex >= drawn.length) return null;
                  const isTabIcon = props.drawTabs && glyph.char === '\t';
                  if (!isTabIcon && !(props.drawSpaces && glyph.char === ' ')) return null;
                  // The per-glyph highlighted colour tints its icon, not a
                  // fixed font_color (text_edit.cpp:1674,1714).
                  const iconColor = multiplyModulate(
                    childTint.own,
                    textEditGlyphColorAt(
                      spans,
                      textEditGlyphLineIndex(glyph, rowStartIndex, glyphIndex),
                      baseFontColor
                    )
                  );
                  const iconXPx = isTabIcon ? glyph.x : glyph.x + (glyph.advance - glyphIconPx) / 2;
                  return (
                    <CanvasItemGroup
                      key={glyphIndex}
                      position={[iconXPx, -((rowHeightPx - glyphIconPx) / 2), 0]}
                    >
                      <ControlQuad
                        width={glyphIconPx}
                        height={glyphIconPx}
                        color={toItemLinear(iconColor)}
                        opacity={iconColor.a}
                        map={isTabIcon ? tabIcon : spaceIcon}
                        renderOrder={renderOrder}
                      />
                    </CanvasItemGroup>
                  );
                })}
            </CanvasItemGroup>
          );
        });
      })}
      <ScrollBarChrome
        bar={scrollBars.horizontal}
        boxes={scrollBarBoxes.horizontal}
        color={childTint.own}
        chromeSlot={slot}
        snapToPixels={snapToPixels}
      />
      <ScrollBarChrome
        bar={scrollBars.vertical}
        boxes={scrollBarBoxes.vertical}
        color={childTint.own}
        chromeSlot={slot}
        snapToPixels={snapToPixels}
      />
    </CanvasItemGroup>
  );
}

export function TextEdit(props: NativeControlComponentProps) {
  return <TextEditBody {...props} />;
}
