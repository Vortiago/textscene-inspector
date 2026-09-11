/**
 * `<RichTextLabel>` — the native (WebGL canvas) painter for
 * RichTextLabel: the bbcode subset `[b]`/`[i]`/`[u]`/`[color]`/`[img]`
 * (anything else is an explicit non-goal) drawn as one `<TextRun>` mesh per
 * (line, contiguous style-run) pair — or one `<RichTextImage>` quad per
 * `[img]` — through the shared MSDF text engine (`native/text/textLayout.ts`
 * + `TextRun.tsx`), the same engine `<Label>` draws through.
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
 * ALIGNMENT — `horizontal_alignment`/`vertical_alignment` reach here through
 * `layoutRichTextRuns`, which resolves BOTH the property and the
 * `[center]`/`[right]`/`[left]`/`[fill]` bbcode tags through the one
 * `_find_alignment` port: the tags are `push_paragraph` calls in Godot
 * (`rich_text_label.cpp:5681-5696`) and the property is the fallback that
 * walk ends at, so they are one input with two spellings, not two features.
 * Each line carries its OWN `lineOffsetXPx` because Godot aligns each by its
 * own width; the paragraph's vertical shift is folded into `lineTopPx`.
 * `HORIZONTAL_ALIGNMENT_FILL` positions like LEFT here — correct for the line
 * ORIGIN, but the intra-line justification is a standing gap this slice's
 * `comparison.md` records.
 *
 * A line's y is its own `lineTopPx`, the running sum of the earlier lines'
 * own heights (NOT `lineIndex * linePitchPx` — lines carrying different font
 * sizes are different heights), which `<TextRun>` anchors at that line's
 * baseline itself (`buildGlyphQuadArrays`'s own doc).
 *
 * Tint: the walker's `tint` prop — `self_modulate` already folded onto the
 * inherited `modulate`. Each run's OWN placement multiplies `tint.own` (still
 * in sRGB) by its own resolved colour, then hands the sRGB result to
 * `<TextRun>`, which converts to linear internally — one conversion, same as
 * every other native text painter.
 *
 * `[img]` — a `RichTextImagePlacement` sibling of the text placements
 * (`nativeSolver.ts`'s `layoutRichTextRuns`/`imageObjectFontMetrics` own the
 * sizing/wrapping math). `<RichTextImage>` mirrors `texturerect/Component.tsx`'s
 * own texture painter: `useTexture2D` against `solveNode.resources` (this
 * node's OWN scope — a `[img]` path inside an instanced sub-scene names that
 * scene's ids), `pinNoColorSpace` before the quad decodes it, `region=`
 * windowed as a UV crop once the real texture size is known. `pad=` degrades
 * to no padding while the texture has not loaded yet, same as every other
 * texture-size-dependent read in this slice.
 */
import { useEffect, useMemo } from 'react';
import { CanvasItemGroup } from '../../../../r3f/components/CanvasItemGroup';
import type { NativeControlComponentProps } from '../../../../r3f/controls/ControlComponentRegistry';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import { painterView } from '../../../../r3f/controls/native/solveTree';
import { multiplyModulate, type RGBA } from '../../../../r3f/canvasItemModulate';
import { godotColorToLinear } from '../../../../r3f/godotColor';
import { useControlClipPlanes } from '../../../../r3f/controls/native/controlClipping';
import { ControlQuad } from '../../../../r3f/controls/native/controlQuad';
import { pinNoColorSpace } from '../../../../r3f/canvas2DTextureDecode';
import { useTexture2D } from '../../../../resources/useTexture2D';
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
  imageObjectFontMetrics,
  layoutRichTextRuns,
  richTextLabelTextTheme,
  richTextUnderlineMetrics,
  styledTextRuns,
  underlineRectPx,
  type RichTextImagePlacement,
} from './nativeSolver';
import type { RichTextLabelProperties } from './types';

interface ImageLike {
  width?: number;
  height?: number;
}

/** One `[img]`'s own quad — `<TextureRect>`'s decode/region convention, sized by the SOLVED box (`placement.widthPx`/`heightPx`), never the texture's own natural size. */
function RichTextImage({
  placement,
  tint,
  resources,
  renderOrder,
}: {
  placement: RichTextImagePlacement;
  tint: RGBA;
  resources: SolveNode['resources'];
  renderOrder: number;
}) {
  const { spec, widthPx, heightPx } = placement;
  const { externalResources, internalResources } = resources;
  const { texture: rawTexture } = useTexture2D(spec.path, externalResources, internalResources);

  const preparedTexture = useMemo(() => {
    if (!rawTexture) return null;
    const cloned = rawTexture.clone();
    // NoColorSpace, pinned: same reason `texturerect/Component.tsx` pins it —
    // `ControlQuad`'s own decode expects an undecoded sRGB sample.
    pinNoColorSpace(cloned);
    if (spec.region) {
      const image = rawTexture.image as ImageLike | undefined;
      const textureW = image?.width ?? 0;
      const textureH = image?.height ?? 0;
      if (textureW > 0 && textureH > 0) {
        cloned.repeat.set(spec.region.w / textureW, spec.region.h / textureH);
        cloned.offset.set(spec.region.x / textureW, 1 - (spec.region.y + spec.region.h) / textureH);
      }
    }
    cloned.needsUpdate = true;
    return cloned;
  }, [rawTexture, spec.region]);

  useEffect(() => () => preparedTexture?.dispose(), [preparedTexture]);

  if (!rawTexture || !preparedTexture) return null;

  // `pad`: centres `min(reservedSize, naturalSize)` inside the box
  // (`rich_text_label.cpp:1091-1096`'s `pad_size`/`pad_off`) — only once the
  // texture's own natural size is known; degrades to no-pad otherwise.
  const image = rawTexture.image as ImageLike | undefined;
  let drawWidthPx = widthPx;
  let drawHeightPx = heightPx;
  let offsetXPx = 0;
  let offsetYPx = 0;
  if (spec.pad && image?.width && image?.height) {
    drawWidthPx = Math.min(widthPx, image.width);
    drawHeightPx = Math.min(heightPx, image.height);
    offsetXPx = (widthPx - drawWidthPx) / 2;
    offsetYPx = (heightPx - drawHeightPx) / 2;
  }

  const imageTint = multiplyModulate(tint, spec.color);

  return (
    <CanvasItemGroup position={[offsetXPx, -offsetYPx, 0]}>
      <ControlQuad
        renderOrder={renderOrder}
        width={drawWidthPx}
        height={drawHeightPx}
        color={godotColorToLinear(imageTint)}
        opacity={imageTint.a}
        map={preparedTexture}
      />
    </CanvasItemGroup>
  );
}

export function RichTextLabel({ solveNode, tint, rect, renderOrder, theme }: NativeControlComponentProps) {
  const props = painterView<RichTextLabelProperties>(solveNode);
  const textTheme = useMemo(() => richTextLabelTextTheme(solveNode, props, { theme }), [solveNode, props, theme]);

  const clippingPlanes = useControlClipPlanes();

  const runs = useMemo(
    () => styledTextRuns(solveNode, props, textTheme.color, textTheme.fontSizePx, theme.fontSize, rect.w),
    [solveNode, props, textTheme.color, textTheme.fontSizePx, theme.fontSize, rect.w]
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
        // Decorated so an [img] run's placeholder character shapes at its own
        // resolved width — nativeSolver.ts's imageObjectFontMetrics.
        fontMetrics: imageObjectFontMetrics(fontMetrics),
      }),
    [plainText, textTheme.fontSizePx, rect.w, autowrapMode, fontSizePxAt, fontMetrics]
  );

  const placements = useMemo(
    () =>
      layoutRichTextRuns(runs, layout, {
        boxWidthPx: rect.w,
        boxHeightPx: rect.h,
        horizontalAlignment: props.horizontalAlignment,
        verticalAlignment: props.verticalAlignment,
      }),
    [runs, layout, rect.w, rect.h, props.horizontalAlignment, props.verticalAlignment]
  );
  const underlineMetrics = useMemo(() => richTextUnderlineMetrics(runs), [runs]);

  return (
    <>
      {placements.map((placement, index) => {
        const y = placement.lineTopPx;
        if (placement.image) {
          return (
            <CanvasItemGroup key={index} position={[placement.lineOffsetXPx + placement.image.xPx, -(y + placement.image.yPx), 0]}>
              <RichTextImage placement={placement.image} tint={tint.own} resources={solveNode.resources} renderOrder={renderOrder} />
            </CanvasItemGroup>
          );
        }
        const runTint = multiplyModulate(tint.own, placement.color);
        const underline = placement.underline
          ? underlineRectPx(placement.layout.lines[0]!.glyphs, placement.layout.baselineOffsetPx, underlineMetrics)
          : null;
        return (
          <CanvasItemGroup key={index} position={[placement.lineOffsetXPx, -y, 0]}>
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
