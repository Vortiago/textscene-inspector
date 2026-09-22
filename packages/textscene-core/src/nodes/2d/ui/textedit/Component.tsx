/**
 * `<TextEdit>` — the native (WebGL canvas) painter for `TextEdit`: the
 * `normal`/`read_only` StyleBox, `highlight_current_line`'s row band, every
 * buffer line shaped and wrapped per `wrap_mode`/`autowrap_mode`, and the
 * `draw_tabs`/`draw_spaces` control-character glyphs — a still frame of
 * `_notification(NOTIFICATION_DRAW)` (`text_edit.cpp:904-1942`) with every
 * interaction-only element removed:
 *
 * - THE CARET, in the ONE frame that has one. `draw_caret` is cleared for an
 *   unfocused node (`:926-927`) and then overwritten from
 *   `caret_draw_when_editable_disabled` while `!editable` (`:945-947`), which
 *   is the only path that puts a caret in a frame with no focus —
 *   `nativeSolver.ts`'s `textEditCaretRect`. Caret 0 rests at line 0, column
 *   0, which a `.tscn` cannot move (that module's own SCROLL IS INERT doc).
 * - NO SELECTION, brace-match underline, word-highlight, search-result box,
 *   IME composition, or minimap: every one of those needs interaction state
 *   (a selection range, a hovered search, a focused IME session) a static
 *   `.tscn` cannot carry. `minimap_draw`/`minimap_width` still narrow the
 *   text's own clip/wrap band exactly as Godot's layout does (`nativeSolver.ts`),
 *   even though the minimap itself is not painted.
 * - NO SCROLLBARS. `h_scroll`/`v_scroll` are internal children whose own type
 *   cannot even appear in a `.tscn` (`ScrollBar` cannot be instantiated), and
 *   this previewer does not model Control-internal children generally.
 * - `scroll_horizontal`/`scroll_vertical` are INERT — `nativeSolver.ts`'s own
 *   doc has the full trace; this painter always shows from (line 0, column 0).
 *
 * TAB/SPACE ICON PLACEMENT is an APPROXIMATION, not a transcription:
 * `text_edit.cpp:1711-1718`'s own `yofs`/`xofs` are relative to a per-row
 * `line_ascent` this codebase's row model does not carry separately from the
 * row's own pitch, and the icon's own on-screen size does not scale with the
 * project theme scale (`GLYPH_ICON_SIZE_PX`'s own doc below — no raw scale
 * reaches this slice). Each icon is centred vertically within its row band instead, and a
 * SPACE icon centred on its own glyph advance (matching Godot's own `xofs`
 * intent exactly); a TAB icon is placed flush at its glyph's pen x (also
 * matching Godot, which applies no horizontal offset to it either).
 *
 * CLIPPING. `text_ci`, the canvas item every row/gutter draws into, is
 * clipped to `Rect2(Point2(0,0), get_size())` — the WHOLE node rect, not a
 * content-margin-inset one (`:932-936`) — so `useWorldClipPlanes` is given
 * `rect` itself, unlike `LineEdit`'s content-rect-only clip.
 *
 * Tint: the walker's `tint` prop, `self_modulate` already folded onto the
 * inherited `modulate`, applied the same way `LineEdit`/`Label` already
 * establish: `tint.own` (raw sRGB) into `<StyleBoxQuad>`'s `color` and into
 * the font/highlight/icon colours before their own single sRGB→linear
 * conversion.
 *
 * `<CodeEdit>` (`../codeedit/Component.tsx`) renders `<TextEditBody>`
 * directly with its own gutter geometry added in, rather than duplicating
 * this file's row/wrap/glyph logic — `CodeEdit::get_minimum_size` and its
 * `NOTIFICATION_DRAW` row loop are both TextEdit's own, unchanged.
 *
 * This component never checks `props.visible`, never renders `children`, and
 * never applies a transform — all three are `ControlCanvasWalker`'s job.
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

/** `text_edit_tab.svg`/`text_edit_space.svg`'s own authored size — unscaled (this slice has no raw project-theme-scale value to rasterise against, unlike Godot's `generate_icon`). */
const GLYPH_ICON_SIZE_PX = 8;

/** `default_theme.cpp:472` (TextEdit) / `:518` (CodeEdit) — the identical literal for both. */
const CURRENT_LINE_COLOR = { r: 0.25, g: 0.25, b: 0.26, a: 0.8 };

/** The stand-in row a buffer line with no shaped rows at all would have — an empty line measures no indent. */
const EMPTY_ROW = { text: '', glyphs: [], widthPx: 0 };

/** `default_theme.cpp:481` (TextEdit) / `:527` (CodeEdit) — `caret_width`, the identical literal for both. Unscaled, like every other constant this slice reads. */
const CARET_WIDTH_PX = 1;

/**
 * `caret_color` — `control_font_color` for both types (`default_theme.cpp:473`,
 * `:526`). NOT the state-dependent font colour: a read-only TextEdit paints its
 * text at `font_readonly_color` and its caret at this, unchanged.
 */
const CARET_COLOR = { r: 0.875, g: 0.875, b: 0.875, a: 1 };

export interface TextEditBodyProps extends NativeControlComponentProps {
  /**
   * Drawn between the panel StyleBox and the row loop — `_draw_guidelines`'s
   * own slot (`text_edit.cpp:1319-1322`), which is a `virtual` the base leaves
   * empty and only `CodeEdit` overrides. Passed in rather than rendered by the
   * caller around this component, because the order between the panel, this,
   * the current-line band and the text is the whole point.
   */
  underlay?: ReactNode;
  /**
   * `gutters_width + gutter_padding` COMBINED — `CodeEdit`'s own gutters;
   * always `0` for a bare `TextEdit` (its own gutter mechanism is never
   * populated from a `.tscn`). `nativeSolver.ts`'s `textEditWrapWidthPx`'s own
   * doc has why the two terms are never passed apart.
   */
  gutterBandWidthPx?: number;
  /** `CodeEdit.indent_size`, forwarded to `TextEdit::set_tab_size` (`code_edit.cpp:908-920`); absent for a bare `TextEdit`, which has no `.tscn` property for it (`nativeSolver.ts`'s `textEditTabStopsPx` own doc). */
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
  const lineSpacingPx = theme.separation; // nativeSolver.ts's own doc.
  const rowHeightPx = textEditRowHeightPx(fontMetrics, fontSizePx, lineSpacingPx);

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

  // `syntax_highlighter` resolves in THIS node's own scope, never
  // `useSceneResources()` — a `CodeHighlighter` is the one concrete
  // `SyntaxHighlighter`; anything else (a custom script, an unresolved ref)
  // leaves `highlighter` null and every line paints at plain `font_color`,
  // exactly as before this resource slice existed.
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
  // Threaded top to bottom, one buffer line at a time — the ONE open,
  // non-line-only region (an unterminated string/comment) carries into the
  // next line (`highlight.ts`'s own doc).
  const lineColorSpans = useMemo<(readonly CodeHighlighterColorSpan[])[] | null>(() => {
    if (!highlighter) return null;
    let region = -1;
    return lines.map((lineText) => {
      const { spans, regionAtLineEnd } = resolveLineColors(lineText, highlighter, baseFontColor, region);
      region = regionAtLineEnd;
      return spans;
    });
  }, [highlighter, lines, baseFontColor]);

  const tintedCurrentLineColor = useMemo(() => multiplyModulate(tint.own, CURRENT_LINE_COLOR), [tint.own]);
  const caretColor = solveNode.colors.caret_color ?? CARET_COLOR;
  const tintedCaretColor = useMemo(() => multiplyModulate(tint.own, caretColor), [tint.own, caretColor]);

  // `text_edit.cpp:1376-1378,1626` — every row starts below the stylebox's own
  // top margin, and its text sits centred in the band that follows.
  const textHeightPx = rowHeightPx - lineSpacingPx;
  const rowBandTopPx = (row: number) =>
    textEditRowBandTopPx(row, rowHeightPx, styleBox.contentMargin.top, lineSpacingPx);
  const caretRect = textEditCaretRect(
    props.editable !== false,
    props.caretDrawWhenEditableDisabled === true,
    band.xMarginBeginPx,
    rowBandTopPx(0),
    rowHeightPx,
    textHeightPx,
    CARET_WIDTH_PX
  );

  // LOCAL, not `rect`: `useWorldClipPlanes` composes its argument with the
  // anchor's own world matrix, so feeding it a rect that already carries the
  // control's offset clips the text at twice that offset.
  const ownRect = useMemo(() => ({ x: 0, y: 0, w: rect.w, h: rect.h }), [rect.w, rect.h]);
  const { anchorRef, clippingPlanes } = useWorldClipPlanes(ownRect);

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
        // Needed for the wrap indent too now, not only for the highlighter's
        // per-character spans, so it is computed whenever EITHER wants it.
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
                    // The SAME per-glyph highlighted colour tints its icon,
                    // not a fixed font_color (text_edit.cpp:1674,1714).
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
