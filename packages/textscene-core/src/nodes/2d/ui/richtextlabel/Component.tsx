/**
 * The native (WebGL canvas) painter for RichTextLabel: the BBCode subset
 * `[b]`/`[i]`/`[u]`/`[color]`/`[img]`, drawn as one `<TextRun>` per line and
 * style run, or one `<RichTextImage>` per `[img]`, through the MSDF text
 * engine `<Label>` uses. Other tags are a non-goal.
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
  richTextTabStopsPx,
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

/**
 * One `[img]` quad, decoded and cropped as `<TextureRect>` does, sized by the
 * solved box, never the texture's natural size. `solveNode.resources` is this
 * node's scope, so an `[img]` inside an instanced sub-scene names its ids.
 */
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
    // `ControlQuad` decodes the sample itself, so it must arrive as undecoded sRGB.
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

  // `pad` centres `min(reservedSize, naturalSize)` inside the box
  // (`rich_text_label.cpp:1091-1096`), and pads nothing until the texture loads.
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

  // Bold and italic are synthesised over the one base font, as `default_theme.cpp`
  // builds `FontVariation`s (`BOLD_DISTANCE_BIAS`, `ITALIC_SKEW`). A styled
  // run reads its own theme font-size key, never `normal_font_size`.
  const runs = useMemo(
    () => styledTextRuns(solveNode, props, textTheme.color, textTheme.fontSizePx, theme.fontSize, rect.w),
    [solveNode, props, textTheme.color, textTheme.fontSizePx, theme.fontSize, rect.w]
  );
  const plainText = useMemo(() => runs.map((r) => r.text).join(''), [runs]);
  const fontSizePxAt = useMemo(() => fontSizePxAtFromRuns(runs), [runs]);
  // RichTextLabel's own default is WORD_SMART (`rich_text_label.h:557`), not Label's OFF.
  const autowrapMode = clampAutowrapMode(props.autowrapMode, RICH_TEXT_LABEL_DEFAULT_AUTOWRAP);

  // Read in the render body, not in the `useMemo` below: see Label's Component.tsx.
  const fontMetrics = resolveNodeFontMetrics(solveNode, RICH_TEXT_LABEL_THEME_FONT_KEY);
  // One shaping pass over the whole text, so line breaks see the paragraph
  // width. `fontSizePxAt` sizes each character by its run.
  const layout = useMemo(
    () =>
      shapeText(plainText, {
        fontSizePx: textTheme.fontSizePx,
        boxWidthPx: rect.w,
        autowrapMode,
        lineSpacingPx: 0, // default_theme.cpp:1217: RichTextLabel's line_separation default, not Label's 3.
        fontSizePxAt,
        // An [img] run's placeholder character shapes at the image's width.
        fontMetrics: imageObjectFontMetrics(fontMetrics),
        tabStopsPx: richTextTabStopsPx(props.tabStopsPx, props.tabSize, fontMetrics, textTheme.fontSizePx),
        autowrapTrimFlags: props.autowrapTrimFlags,
      }),
    [plainText, textTheme.fontSizePx, rect.w, autowrapMode, fontSizePxAt, fontMetrics, props.tabStopsPx, props.tabSize, props.autowrapTrimFlags]
  );

  // The alignment property and the `[center]`/`[right]`/`[left]`/`[fill]` tags
  // (`rich_text_label.cpp:5681-5696`) resolve through one `_find_alignment`
  // port. FILL positions like LEFT: `comparison.md` records the justification gap.
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
        // `lineTopPx` sums the earlier lines' heights, since font sizes vary by line.
        // The tint multiplies in sRGB and `<TextRun>` converts once.
        const runTint = multiplyModulate(tint.own, placement.color);
        // `[u]` is a stroke on the line's baseline with the paragraph's metrics,
        // snapped to whole pixel rows, at `underline_alpha` times the opacity.
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
