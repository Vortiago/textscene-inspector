/**
 * `<TextEdit>` — the native (WebGL canvas) painter for `TextEdit`: the
 * `normal`/`read_only` StyleBox, `highlight_current_line`'s row band, every
 * buffer line shaped and wrapped per `wrap_mode`/`autowrap_mode`, and the
 * `draw_tabs`/`draw_spaces` control-character glyphs — a still frame of
 * `_notification(NOTIFICATION_DRAW)` (`text_edit.cpp:904-1942`) with every
 * interaction-only element removed:
 *
 * - NO CARET. `draw_caret` is gated on focus (`:926`) or on
 *   `caret_draw_when_editable_disabled` while `!editable` (`:945-947`, which
 *   can re-enable it independently of focus) — LineEdit's own painter draws
 *   no caret at all regardless of `caret_force_displayed`, and this stays
 *   consistent with that choice rather than special-casing the one property
 *   combination that would draw one here.
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
import { useMemo } from 'react';
import { CanvasItemGroup } from '../../../../r3f/components/CanvasItemGroup';
import type { NativeControlComponentProps } from '../../../../r3f/controls/ControlComponentRegistry';
import { painterView } from '../../../../r3f/controls/native/solveTree';
import { StyleBoxQuad } from '../../../../r3f/controls/native/StyleBoxQuad';
import { ControlQuad } from '../../../../r3f/controls/native/controlQuad';
import { useWorldClipPlanes } from '../../../../r3f/controls/native/controlClipping';
import { useIconTexture } from '../../../../r3f/controls/native/useIconTexture';
import { multiplyModulate } from '../../../../r3f/canvasItemModulate';
import { godotColorToLinear } from '../../../../r3f/godotColor';
import { TextRun } from '../../../../r3f/controls/native/text/TextRun';
import { soloLineLayout } from '../../../../r3f/controls/native/text/textLayout';
import { resolveNodeFontMetrics } from '../../../../r3f/controls/native/text/resolveNodeFontMetrics';
import {
  pickTextEditStyleBox,
  resolveTextEditStyleState,
  textEditTextTheme,
  textEditRowHeightPx,
  textEditWrapWidthPx,
  shapeTextEditLines,
  layoutTextEditDrawBand,
  TEXT_EDIT_THEME_FONT_KEY,
} from './nativeSolver';
import { TEXT_EDIT_GLYPH_ICONS } from '../../../../r3f/controls/native/themeIcons';
import type { TextEditProperties } from './types';

/** `text_edit_tab.svg`/`text_edit_space.svg`'s own authored size — unscaled (this slice has no raw project-theme-scale value to rasterise against, unlike Godot's `generate_icon`). */
const GLYPH_ICON_SIZE_PX = 8;

/** `default_theme.cpp:472` (TextEdit) / `:518` (CodeEdit) — the identical literal for both. */
const CURRENT_LINE_COLOR = { r: 0.25, g: 0.25, b: 0.26, a: 0.8 };

export interface TextEditBodyProps extends NativeControlComponentProps {
  /**
   * `gutters_width + gutter_padding` COMBINED — `CodeEdit`'s own gutters;
   * always `0` for a bare `TextEdit` (its own gutter mechanism is never
   * populated from a `.tscn`). `nativeSolver.ts`'s `textEditWrapWidthPx`'s own
   * doc has why the two terms are never passed apart.
   */
  gutterBandWidthPx?: number;
}

export function TextEditBody({
  solveNode,
  tint,
  rect,
  renderOrder,
  theme,
  gutterBandWidthPx = 0,
}: TextEditBodyProps) {
  const props = painterView<TextEditProperties>(solveNode);
  const state = resolveTextEditStyleState(props.editable);
  const styleBox = pickTextEditStyleBox(solveNode.styleBoxes, theme.widgets.lineEdit, state);

  const { fontSizePx, color: baseFontColor } = textEditTextTheme(solveNode, props, state, { theme });
  const tintedFontColor = useMemo(() => multiplyModulate(tint.own, baseFontColor), [tint.own, baseFontColor]);
  const linearFontColor = useMemo(() => godotColorToLinear(tintedFontColor), [tintedFontColor]);

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
  const lineLayouts = useMemo(
    () => shapeTextEditLines(lines, fontSizePx, props.wrapMode, props.autowrapMode, wrapWidthPx, fontMetrics),
    [lines, fontSizePx, props.wrapMode, props.autowrapMode, wrapWidthPx, fontMetrics]
  );

  const tintedCurrentLineColor = useMemo(() => multiplyModulate(tint.own, CURRENT_LINE_COLOR), [tint.own]);

  const { anchorRef, clippingPlanes } = useWorldClipPlanes(rect);

  const tabIcon = useIconTexture(TEXT_EDIT_GLYPH_ICONS.tab);
  const spaceIcon = useIconTexture(TEXT_EDIT_GLYPH_ICONS.space);

  return (
    <CanvasItemGroup ref={anchorRef}>
      <StyleBoxQuad styleBox={styleBox} color={tint.own} rect={rect} renderOrder={renderOrder} />
      {props.highlightCurrentLine && (
        <ControlQuad
          width={band.xMarginEndPx}
          height={rowHeightPx}
          color={godotColorToLinear(tintedCurrentLineColor)}
          opacity={tintedCurrentLineColor.a}
          renderOrder={renderOrder}
        />
      )}
      {lineLayouts.map(({ layout, startRow }, lineIndex) =>
        layout.lines.map((line, rowInLine) => {
          const row = startRow + rowInLine;
          const rowTopPx = row * rowHeightPx;
          return (
            <CanvasItemGroup key={`${lineIndex}-${rowInLine}`} position={[band.xMarginBeginPx, -rowTopPx, 0]}>
              <TextRun
                layout={soloLineLayout(line, layout)}
                fontSizePx={fontSizePx}
                tint={tintedFontColor}
                clippingPlanes={clippingPlanes}
                renderOrder={renderOrder}
              />
              {(props.drawTabs || props.drawSpaces) &&
                line.glyphs.map((glyph, glyphIndex) => {
                  if (props.drawTabs && glyph.char === '\t') {
                    return (
                      <CanvasItemGroup key={glyphIndex} position={[glyph.x, -((rowHeightPx - GLYPH_ICON_SIZE_PX) / 2), 0]}>
                        <ControlQuad
                          width={GLYPH_ICON_SIZE_PX}
                          height={GLYPH_ICON_SIZE_PX}
                          color={linearFontColor}
                          opacity={tintedFontColor.a}
                          map={tabIcon}
                          renderOrder={renderOrder}
                        />
                      </CanvasItemGroup>
                    );
                  }
                  if (props.drawSpaces && glyph.char === ' ') {
                    const xOfs = glyph.x + (glyph.advance - GLYPH_ICON_SIZE_PX) / 2;
                    return (
                      <CanvasItemGroup key={glyphIndex} position={[xOfs, -((rowHeightPx - GLYPH_ICON_SIZE_PX) / 2), 0]}>
                        <ControlQuad
                          width={GLYPH_ICON_SIZE_PX}
                          height={GLYPH_ICON_SIZE_PX}
                          color={linearFontColor}
                          opacity={tintedFontColor.a}
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
        })
      )}
    </CanvasItemGroup>
  );
}

export function TextEdit(props: NativeControlComponentProps) {
  return <TextEditBody {...props} />;
}
