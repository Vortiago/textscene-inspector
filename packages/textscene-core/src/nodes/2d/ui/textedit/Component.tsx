/**
 * `<TextEdit>`: the native (WebGL canvas) painter, a still frame of `_notification(NOTIFICATION_DRAW)`
 * (`text_edit.cpp:904-1942`) from line 0, column 0 (scrolling is inert, see nativeSolver.ts), with no
 * selection, brace match, word highlight, search box, IME or minimap. `<CodeEdit>` renders
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
import { multiplyModulate } from '../../../../r3f/canvasItemModulate';
import { godotColorToLinear } from '../../../../r3f/godotColor';
import { TextRun } from '../../../../r3f/controls/native/text/TextRun';
import { soloLineLayout } from '../../../../r3f/controls/native/text/textLayout';
import { resolveNodeFontMetrics } from '../../../../r3f/controls/native/text/resolveNodeFontMetrics';
import { useSubOrExtResource } from '../../../../resources/useSubOrExtResource';
import { decodeCodeHighlighter } from '../../../../resources/styles/codehighlighter/decode';
import { resolveLineColors, type CodeHighlighterColorSpan } from '../../../../resources/styles/codehighlighter/highlight';
import {
  textEditCaretRect,
  textEditWrapIndentPx,
  textEditFirstIndentRow,
  textEditRowBandTopPx,
  textEditRowTextTopPx,
  pickTextEditStyleBox,
  resolveTextEditStyleState,
  textEditTextTheme,
  textEditRowHeightPx,
  textEditWrapWidthPx,
  shapeTextEditLines,
  layoutTextEditDrawBand,
  textEditCurrentLineXPx,
  textEditRowOriginXPx,
  textEditRowStartIndices,
  textEditRowColorRuns,
  textEditColorRunLine,
  textEditGlyphColorAt,
  textEditTabStopsPx,
  TEXT_EDIT_THEME_FONT_KEY,
} from './nativeSolver';
import { TEXT_EDIT_GLYPH_ICONS } from '../../../../r3f/controls/native/themeIcons';
import type { TextEditProperties } from './types';

/** `text_edit_tab.svg`/`text_edit_space.svg`'s authored size, unscaled: no raw theme scale reaches this slice, unlike Godot's `generate_icon`. */
const GLYPH_ICON_SIZE_PX = 8;

/** `default_theme.cpp:472` (TextEdit) / `:518` (CodeEdit): the same literal for both. */
const CURRENT_LINE_COLOR = { r: 0.25, g: 0.25, b: 0.26, a: 0.8 };

/** The stand-in row for a buffer line with no shaped rows: an empty line measures no indent. */
const EMPTY_ROW = { text: '', glyphs: [], widthPx: 0 };

/** `default_theme.cpp:481` (TextEdit) / `:527` (CodeEdit): `caret_width`, the same literal for both. Unscaled, like every constant here. */
const CARET_WIDTH_PX = 1;

/**
 * `caret_color`: `control_font_color` for both types (`default_theme.cpp:473`, `:526`). Not
 * the state-dependent font colour: a read-only TextEdit paints its text at
 * `font_readonly_color` and its caret at this.
 */
const CARET_COLOR = { r: 0.875, g: 0.875, b: 0.875, a: 1 };

export interface TextEditBodyProps extends NativeControlComponentProps {
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
}

export function TextEditBody({
  solveNode,
  tint,
  rect,
  renderOrder,
  theme,
  gutterBandWidthPx = 0,
  tabSize,
  underlay,
}: TextEditBodyProps) {
  const props = painterView<TextEditProperties>(solveNode);
  const state = resolveTextEditStyleState(props.editable);
  const styleBox = pickTextEditStyleBox(solveNode.styleBoxes, theme.widgets.lineEdit, state);

  const { fontSizePx, color: baseFontColor } = textEditTextTheme(solveNode, props, state, { theme });

  const fontMetrics = resolveNodeFontMetrics(solveNode, TEXT_EDIT_THEME_FONT_KEY);
  const lineSpacingPx = theme.separation; // nativeSolver.ts says why.
  const rowHeightPx = textEditRowHeightPx(fontMetrics, fontSizePx, lineSpacingPx);

  // `minimap_draw`/`minimap_width` narrow the text band as Godot's layout does, although the
  // minimap is not painted. No scrollbar term applies: `h_scroll`/`v_scroll` are internal
  // children, and a `ScrollBar` cannot appear in a `.tscn`.
  const band = layoutTextEditDrawBand(
    rect.w,
    styleBox,
    gutterBandWidthPx,
    props.minimapWidth ?? 80,
    props.minimapDraw,
    rowHeightPx
  );
  const wrapWidthPx = useMemo(
    () =>
      textEditWrapWidthPx(
        rect.w,
        styleBox.contentMargin.left + styleBox.contentMargin.right,
        gutterBandWidthPx,
        props.minimapWidth ?? 80,
        props.minimapDraw
      ),
    [rect.w, styleBox, gutterBandWidthPx, props.minimapWidth, props.minimapDraw]
  );

  const lines = useMemo(() => (props.text ?? '').split('\n'), [props.text]);
  const tabStopsPx = useMemo(() => textEditTabStopsPx(tabSize, fontMetrics, fontSizePx), [tabSize, fontMetrics, fontSizePx]);
  const lineLayouts = useMemo(
    () =>
      shapeTextEditLines(
        lines,
        fontSizePx,
        props.wrapMode,
        props.autowrapMode,
        wrapWidthPx,
        fontMetrics,
        tabStopsPx,
        props.drawControlChars,
        props.indentWrappedLines
      ),
    [
      lines,
      fontSizePx,
      props.wrapMode,
      props.autowrapMode,
      wrapWidthPx,
      fontMetrics,
      tabStopsPx,
      props.drawControlChars,
      props.indentWrappedLines,
    ]
  );

  // `syntax_highlighter` resolves in this node's scope, never `useSceneResources()`. Only a
  // `CodeHighlighter` decodes: anything else leaves `highlighter` null, and lines paint at `font_color`.
  const highlighterResource = useSubOrExtResource(
    props.syntaxHighlighter,
    solveNode.resources.internalResources,
    solveNode.resources.externalResources
  );
  const highlighter = useMemo(
    () =>
      highlighterResource?.type === 'CodeHighlighter'
        ? decodeCodeHighlighter(highlighterResource.data as Record<string, string>)
        : null,
    [highlighterResource]
  );
  // Threaded line by line: one open region (an unterminated string or comment)
  // carries into the next line (`highlight.ts`).
  const lineColorSpans = useMemo<(readonly CodeHighlighterColorSpan[])[] | null>(() => {
    if (!highlighter) return null;
    let region = -1;
    return lines.map((lineText) => {
      const { spans, regionAtLineEnd } = resolveLineColors(lineText, highlighter, baseFontColor, region);
      region = regionAtLineEnd;
      return spans;
    });
  }, [highlighter, lines, baseFontColor]);

  // `tint.own` (raw sRGB, `self_modulate` folded onto `modulate`) tints the StyleBoxQuad and every
  // font, highlight and icon colour before its one sRGB-to-linear conversion, as in LineEdit.
  const tintedCurrentLineColor = useMemo(() => multiplyModulate(tint.own, CURRENT_LINE_COLOR), [tint.own]);
  const caretColor = solveNode.colors.caret_color ?? CARET_COLOR;
  const tintedCaretColor = useMemo(() => multiplyModulate(tint.own, caretColor), [tint.own, caretColor]);

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
      {underlay}
      {props.highlightCurrentLine && (
        <CanvasItemGroup
          position={[textEditCurrentLineXPx(band.xMarginEndPx, rect.w, solveNode.rtl), -rowBandTopPx(0), 0]}
        >
          <ControlQuad
            width={band.xMarginEndPx}
            height={rowHeightPx}
            color={godotColorToLinear(tintedCurrentLineColor)}
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
            color={godotColorToLinear(tintedCaretColor)}
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
          spans || props.indentWrappedLines ? textEditRowStartIndices(lineText, layout.lines) : undefined;
        const wrapIndentPx = props.indentWrappedLines
          ? textEditWrapIndentPx(layout.lines[0] ?? EMPTY_ROW, lineText, wrapWidthPx)
          : 0;
        const firstIndentRow = props.indentWrappedLines
          ? textEditFirstIndentRow(lineText, rowStartIndices ?? [0])
          : 0;
        return layout.lines.map((line, rowInLine) => {
          const row = startRow + rowInLine;
          const rowTopPx = textEditRowTextTopPx(rowBandTopPx(row), rowHeightPx, textHeightPx);
          const rowStartIndex = rowStartIndices?.[rowInLine] ?? 0;
          const runs = textEditRowColorRuns(line.glyphs, rowStartIndex, spans, baseFontColor);
          return (
            <CanvasItemGroup
              key={`${lineIndex}-${rowInLine}`}
              position={[
                textEditRowOriginXPx(
                  band.xMarginBeginPx,
                  rect.w,
                  line.widthPx,
                  solveNode.rtl,
                  rowInLine > firstIndentRow ? wrapIndentPx : 0
                ),
                -rowTopPx,
                0,
              ]}
            >
              {runs.map((run, runIndex) => (
                <TextRun
                  key={runIndex}
                  layout={soloLineLayout(textEditColorRunLine(run), layout)}
                  fontSizePx={fontSizePx}
                  tint={multiplyModulate(tint.own, run.color)}
                  clippingPlanes={clippingPlanes}
                  renderOrder={renderOrder}
                />
              ))}
              {(props.drawTabs || props.drawSpaces) &&
                line.glyphs.map((glyph, glyphIndex) => {
                  if (props.drawTabs && glyph.char === '\t') {
                    // The per-glyph highlighted colour tints its icon, not a
                    // fixed font_color (text_edit.cpp:1674,1714).
                    const iconColor = multiplyModulate(
                      tint.own,
                      textEditGlyphColorAt(spans, rowStartIndex + glyphIndex, baseFontColor)
                    );
                    return (
                      <CanvasItemGroup key={glyphIndex} position={[glyph.x, -((rowHeightPx - GLYPH_ICON_SIZE_PX) / 2), 0]}>
                        <ControlQuad
                          width={GLYPH_ICON_SIZE_PX}
                          height={GLYPH_ICON_SIZE_PX}
                          color={godotColorToLinear(iconColor)}
                          opacity={iconColor.a}
                          map={tabIcon}
                          renderOrder={renderOrder}
                        />
                      </CanvasItemGroup>
                    );
                  }
                  if (props.drawSpaces && glyph.char === ' ') {
                    const xOfs = glyph.x + (glyph.advance - GLYPH_ICON_SIZE_PX) / 2;
                    const iconColor = multiplyModulate(
                      tint.own,
                      textEditGlyphColorAt(spans, rowStartIndex + glyphIndex, baseFontColor)
                    );
                    return (
                      <CanvasItemGroup key={glyphIndex} position={[xOfs, -((rowHeightPx - GLYPH_ICON_SIZE_PX) / 2), 0]}>
                        <ControlQuad
                          width={GLYPH_ICON_SIZE_PX}
                          height={GLYPH_ICON_SIZE_PX}
                          color={godotColorToLinear(iconColor)}
                          opacity={iconColor.a}
                          map={spaceIcon}
                          renderOrder={renderOrder}
                        />
                      </CanvasItemGroup>
                    );
                  }
                  return null;
                })}
            </CanvasItemGroup>
          );
        });
      })}
    </CanvasItemGroup>
  );
}

export function TextEdit(props: NativeControlComponentProps) {
  return <TextEditBody {...props} />;
}
