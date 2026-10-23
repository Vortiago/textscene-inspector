/**
 * The native (WebGL canvas) painter for RichTextLabel: the BBCode subset
 * `[b]`/`[i]`/`[u]`/`[color]`/`[img]`, drawn as one `<TextRun>` per line and
 * style run, or one `<RichTextImage>` per `[img]`, through the MSDF text
 * engine `<Label>` uses. Other tags are a non-goal.
 */
import { useMemo } from 'react';
import { CanvasItemGroup } from '../../../../r3f/components/CanvasItemGroup';
import type { NativeControlComponentProps } from '../../../../r3f/controls/ControlComponentRegistry';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import { painterView } from '../../../../r3f/controls/native/solveTree';
import { multiplyModulate } from '../../../../r3f/canvasItemModulate';
import { godotColorToLinear } from '../../../../r3f/godotColor';
import { useControlClipPlanes } from '../../../../r3f/controls/native/controlClipping';
import { ControlQuad } from '../../../../r3f/controls/native/controlQuad';
import { useOwnerCanvas2DTexture } from '../../../../r3f/canvas2DTextureDecode';
import { WHOLE_FRAME, frameUvWindow } from '../../../../r3f/spriteFrame';
import { useUvWindow } from '../../../../r3f/useUvWindow';
import { useTexture2D } from '../../../../resources/useTexture2D';
import { clampAutowrapMode } from '../../../../r3f/controls/native/text/textLayout';
import { TextRun } from '../../../../r3f/controls/native/text/TextRun';
import {
  RICH_TEXT_LABEL_UNDERLINE_ALPHA,
  RICH_TEXT_LABEL_DEFAULT_AUTOWRAP,
  layoutRichTextRuns,
  richTextLabelTextTheme,
  richTextUnderlineMetrics,
  shapeRichText,
  styledTextRuns,
  underlineRectPx,
  type RichTextImagePlacement,
} from './nativeSolver';
import { resolveRichTextFaces } from './styleFaces';
import type { RichTextLabelProperties } from './types';
import type { Rgba } from '../../../../godot/math/math';

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
  tint: Rgba;
  resources: SolveNode['resources'];
  renderOrder: number;
}) {
  const { spec, widthPx, heightPx } = placement;
  const { externalResources, internalResources } = resources;
  const { texture: rawTexture } = useTexture2D(spec.path, externalResources, internalResources);

  // `ControlQuad` decodes the sample itself, so the clone arrives as undecoded sRGB.
  const drawnTexture = useOwnerCanvas2DTexture(rawTexture);
  const regionWindow = useMemo(
    () =>
      frameUvWindow(rawTexture ?? undefined, {
        ...WHOLE_FRAME,
        region_enabled: spec.region !== undefined,
        region_rect: spec.region && {
          x: spec.region.x,
          y: spec.region.y,
          width: spec.region.w,
          height: spec.region.h,
        },
      }),
    [rawTexture, spec.region]
  );
  useUvWindow(drawnTexture, regionWindow);

  if (!rawTexture || !drawnTexture) return null;

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
        map={drawnTexture}
      />
    </CanvasItemGroup>
  );
}

export function RichTextLabel({ solveNode, tint, rect, renderOrder, theme }: NativeControlComponentProps) {
  const props = painterView<RichTextLabelProperties>(solveNode);
  const textTheme = useMemo(
    () => richTextLabelTextTheme(solveNode, props, { theme }),
    [solveNode, props, theme]
  );

  const clippingPlanes = useControlClipPlanes();

  // A styled run reads its own theme font-size key, never `normal_font_size`.
  const runs = useMemo(
    () => styledTextRuns(solveNode, props, textTheme.color, textTheme.fontSizePx, theme.fontSize, rect.w),
    [solveNode, props, textTheme.color, textTheme.fontSizePx, theme.fontSize, rect.w]
  );
  // RichTextLabel's own default is WORD_SMART (`rich_text_label.h:557`), not Label's OFF.
  const autowrapMode = clampAutowrapMode(props.autowrapMode, RICH_TEXT_LABEL_DEFAULT_AUTOWRAP);

  // Read in the render body, not in the `useMemo` below: see Label's Component.tsx.
  const { normal, bold, italic, boldItalic } = resolveRichTextFaces(solveNode, runs);
  const layout = useMemo(
    () =>
      shapeRichText(
        runs,
        { normal, bold, italic, boldItalic },
        {
          fontSizePx: textTheme.fontSizePx,
          boxWidthPx: rect.w,
          autowrapMode,
          tabStopsPx: props.tabStopsPx,
          tabSize: props.tabSize,
          autowrapTrimFlags: props.autowrapTrimFlags,
        }
      ),
    [
      runs,
      normal,
      bold,
      italic,
      boldItalic,
      textTheme.fontSizePx,
      rect.w,
      autowrapMode,
      props.tabStopsPx,
      props.tabSize,
      props.autowrapTrimFlags,
    ]
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
            <CanvasItemGroup
              key={index}
              position={[placement.lineOffsetXPx + placement.image.xPx, -(y + placement.image.yPx), 0]}
            >
              <RichTextImage
                placement={placement.image}
                tint={tint.own}
                resources={solveNode.resources}
                renderOrder={renderOrder}
              />
            </CanvasItemGroup>
          );
        }
        // `lineTopPx` sums the earlier lines' heights, since font sizes vary by line.
        // The tint multiplies in sRGB and `<TextRun>` converts once.
        const runTint = multiplyModulate(tint.own, placement.color);
        // `[u]` is a stroke on the line's baseline with the paragraph's metrics,
        // snapped to whole pixel rows, at `underline_alpha` times the opacity.
        const underline = placement.underline
          ? underlineRectPx(
              placement.layout.lines[0]!.glyphs,
              placement.layout.baselineOffsetPx,
              underlineMetrics
            )
          : null;
        return (
          <CanvasItemGroup key={index} position={[placement.lineOffsetXPx, -y, 0]}>
            <TextRun
              layout={placement.layout}
              fontSizePx={placement.fontSizePx}
              tint={runTint}
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
