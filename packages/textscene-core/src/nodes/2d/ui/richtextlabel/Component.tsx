/**
 * `<RichTextLabel>` — the native (WebGL canvas) painter for
 * RichTextLabel: the bbcode subset `[b]`/`[i]`/`[u]`/`[color]` (anything
 * beyond that is an explicit non-goal) drawn as one `<TextRun>` mesh per
 * (line, contiguous style-run) pair through the shared MSDF text engine
 * (`native/text/textLayout.ts` + `TextRun.tsx`), the same engine `<Label>`
 * draws through.
 *
 * Bold/italic are SYNTHESIZED, not separate fonts — Godot's own default
 * theme has one base font and builds bold/italic `FontVariation`s over it
 * (`nativeSolver.ts`'s `BOLD_DISTANCE_BIAS`/`ITALIC_SKEW` cite the exact
 * `default_theme.cpp` embolden/skew constants). `[u]` is a drawn STROKE, not
 * a font effect: `nativeSolver.ts`'s `underlineRectPx` computes its rect from
 * the run's own glyph x-extent, its LINE's own baseline and the PARAGRAPH's
 * underline position/thickness (`richTextUnderlineMetrics`, whose doc has
 * Godot's own reason for that line/paragraph split), snapped to the whole
 * pixel rows Godot's un-antialiased `draw_line` quad covers, and drawn as an
 * extra `<ControlQuad>` sibling of the run's own `<TextRun>` at
 * `RICH_TEXT_LABEL_UNDERLINE_ALPHA` times the run's own opacity — Godot's own
 * `underline_alpha` theme constant, a dimmer stroke rather than a
 * differently-coloured one. `nativeSolver.ts`'s `styledTextRuns` turns the
 * bbcode tag stack into `{bold, italic, underline, color, fontSizePx}` per
 * run — `fontSizePx` is each run's OWN resolved theme font-size key
 * (`bold_font_size`/`italics_font_size`/`bold_italics_font_size`, never a
 * fallback to `normal_font_size`: `resolveRunFontSizePx`'s own doc), fed to
 * `shapeText` as a per-CHARACTER override (`fontSizePxAtFromRuns`) so a
 * styled run's own glyphs advance at its own size while `layoutRichTextRuns`
 * still attributes `shapeText`'s own line/glyph output back to those runs
 * (shaping happens ONCE, over the whole concatenated plain text, so
 * line-breaking sees the true paragraph width rather than each run measured
 * in isolation) — each placement then hands its OWN `fontSizePx` to its own
 * `<TextRun>`, while every run on a line shares that LINE's baseline
 * (`richTextLineMetrics`), Godot's own `off.y += l_ascent`.
 *
 * RichTextLabel has no `horizontal_alignment`/`vertical_alignment` Control
 * property (unlike Label) — every line is left-aligned, and the paragraph as
 * a whole is top-aligned, so there is no `layoutLabelLines`-style alignment
 * pass here: each line's y is its own `lineTopPx`, the running sum of the
 * earlier lines' own heights (NOT `lineIndex * linePitchPx` — lines carrying
 * different font sizes are different heights), which `<TextRun>` anchors at
 * that line's baseline itself (`buildGlyphQuadArrays`'s own doc).
 *
 * Tint: `ControlCanvasWalker` already folds this node's OWN `modulate` into
 * the `Modulate2DContext` value it provides AROUND this painter, so
 * `useCanvasItemTint` is called ONCE, with `modulate: WHITE_MODULATE`
 * (already folded in) and this node's own `self_modulate` — but with NO
 * `ownMultiplier` (each run's resolved colour differs, so there is no single
 * "the" text colour to fold in at that call). `tint.own` is therefore
 * `inherited * self_modulate`, sRGB; each run's OWN placement multiplies that
 * (still in sRGB, via the plain `multiplyModulate` — not a hook, since the
 * number of runs varies per render and hooks cannot be called a variable
 * number of times) by its own resolved colour, then hands the sRGB result to
 * `<TextRun>`, which converts to linear internally — one conversion, same as
 * every other native text painter.
 */
import { useMemo } from 'react';
import { CanvasItemGroup } from '../../../../r3f/components/CanvasItemGroup';
import type { NativeControlComponentProps } from '../../../../r3f/controls/ControlComponentRegistry';
import { multiplyModulate, useCanvasItemTint, WHITE_MODULATE, type RGBA } from '../../../../r3f/canvasItemModulate';
import { godotColorToLinear } from '../../../../r3f/godotColor';
import { useControlClipPlanes } from '../../../../r3f/controls/native/controlClipping';
import { ControlQuad } from '../../../../r3f/controls/native/controlQuad';
import { clampAutowrapMode, shapeText } from '../../../../r3f/controls/native/text/textLayout';
import { TextRun } from '../../../../r3f/controls/native/text/TextRun';
import { resolveNodeFontMetrics } from '../../../../r3f/controls/native/text/resolveNodeFontMetrics';
import {
  BOLD_DISTANCE_BIAS,
  ITALIC_SKEW,
  RICH_TEXT_LABEL_UNDERLINE_ALPHA,
  RICH_TEXT_LABEL_DEFAULT_AUTOWRAP,
  RICH_TEXT_LABEL_THEME_FONT_KEY,
  fontSizePxAtFromRuns,
  layoutRichTextRuns,
  richTextLabelTextTheme,
  richTextUnderlineMetrics,
  styledTextRuns,
  underlineRectPx,
} from './nativeSolver';
import type { RichTextLabelProperties } from './types';

export function RichTextLabel({ solveNode, rect, renderOrder, theme }: NativeControlComponentProps) {
  const props = solveNode.node.properties as RichTextLabelProperties;
  const textTheme = useMemo(() => richTextLabelTextTheme(solveNode, props, { theme }), [solveNode, props, theme]);

  const selfModulate: RGBA = props.selfModulate ?? WHITE_MODULATE;
  const tint = useCanvasItemTint({ modulate: WHITE_MODULATE, self_modulate: selfModulate });
  const clippingPlanes = useControlClipPlanes();

  const runs = useMemo(
    () => styledTextRuns(solveNode, props, textTheme.color, textTheme.fontSizePx, theme.fontSize),
    [solveNode, props, textTheme.color, textTheme.fontSizePx, theme.fontSize]
  );
  const plainText = useMemo(() => runs.map((r) => r.text).join(''), [runs]);
  const fontSizePxAt = useMemo(() => fontSizePxAtFromRuns(runs), [runs]);
  // RichTextLabel's own default is WORD_SMART (`rich_text_label.h:557`), not Label's OFF.
  const autowrapMode = clampAutowrapMode(props.autowrapMode, RICH_TEXT_LABEL_DEFAULT_AUTOWRAP);

  // Read INSIDE the render body, not the `useMemo` below — see Label's own
  // Component.tsx for why.
  const fontMetrics = resolveNodeFontMetrics(solveNode, RICH_TEXT_LABEL_THEME_FONT_KEY);
  const layout = useMemo(
    () =>
      shapeText(plainText, {
        fontSizePx: textTheme.fontSizePx,
        boxWidthPx: rect.w,
        autowrapMode,
        lineSpacingPx: 0, // default_theme.cpp:1217 — RichTextLabel's own line_separation default, NOT Label's 3.
        fontSizePxAt, // a [b]/[i]/[b][i] run shapes at its OWN theme font-size key, not normal_font_size — nativeSolver.ts's resolveRunFontSizePx.
        fontMetrics,
      }),
    [plainText, textTheme.fontSizePx, rect.w, autowrapMode, fontSizePxAt, fontMetrics]
  );

  const placements = useMemo(() => layoutRichTextRuns(runs, layout), [runs, layout]);
  const underlineMetrics = useMemo(() => richTextUnderlineMetrics(runs), [runs]);

  return (
    <>
      {placements.map((placement, index) => {
        const runTint = multiplyModulate(tint.own, placement.color);
        const y = placement.lineTopPx;
        const underline = placement.underline
          ? underlineRectPx(placement.layout.lines[0]!.glyphs, placement.layout.baselineOffsetPx, underlineMetrics)
          : null;
        return (
          <CanvasItemGroup key={index} position={[0, -y, 0]}>
            <TextRun
              layout={placement.layout}
              fontSizePx={placement.fontSizePx}
              tint={runTint}
              distanceBias={placement.bold ? BOLD_DISTANCE_BIAS : 0}
              skew={placement.italic ? ITALIC_SKEW : 0}
              clippingPlanes={clippingPlanes}
              renderOrder={renderOrder}
            />
            {underline && (
              <CanvasItemGroup position={[underline.x0, -underline.topPx, 0]}>
                <ControlQuad
                  width={underline.x1 - underline.x0}
                  height={underline.heightPx}
                  color={godotColorToLinear(runTint)}
                  opacity={runTint.a * RICH_TEXT_LABEL_UNDERLINE_ALPHA}
                  renderOrder={renderOrder}
                />
              </CanvasItemGroup>
            )}
          </CanvasItemGroup>
        );
      })}
    </>
  );
}
