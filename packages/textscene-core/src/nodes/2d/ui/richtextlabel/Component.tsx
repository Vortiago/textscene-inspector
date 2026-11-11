/**
 * The native (WebGL canvas) painter for RichTextLabel: the BBCode subset
 * `[b]`/`[i]`/`[u]`/`[color]`/`[font_size]`/`[outline_size]`/`[outline_color]`/`[img]`,
 * drawn as one `<OutlinedTextRun>` per line and style run, or one `<RichTextImage>` per
 * `[img]`, through the MSDF text engine `<Label>` uses. Other tags are a non-goal.
 */
import { useCallback, useMemo } from 'react';
import type * as THREE from 'three';
import { CanvasItemGroup } from '../../../../r3f/components/CanvasItemGroup';
import type { NativeControlComponentProps } from '../../../../r3f/controls/ControlComponentRegistry';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import { painterView } from '../../../../r3f/controls/native/solveTree';
import { multiplyModulate, useItemLinearColorOf } from '../../../../r3f/canvasItemModulate';
import {
  ControlClipProvider,
  useControlClipPlanes,
  useWorldClipPlanes,
} from '../../../../r3f/controls/native/controlClipping';
import { ControlQuad } from '../../../../r3f/controls/native/controlQuad';
import { useWindowedCanvas2DTexture } from '../../../../r3f/canvas2DTextureDecode';
import { useResolvedTextureSampler } from '../../../../r3f/canvasItemTextureSampler';
import { WHOLE_FRAME, frameUvWindow } from '../../../../r3f/spriteFrame';
import { useTexture2D } from '../../../../resources/useTexture2D';
import { clampAutowrapMode } from '../../../../r3f/controls/native/text/textLayout';
import { OutlinedTextRun } from '../../../../r3f/controls/native/text/OutlinedTextRun';
import { ScrollBarChrome } from '../shared/ScrollChrome';
import {
  RICH_TEXT_LABEL_UNDERLINE_ALPHA,
  RICH_TEXT_LABEL_DEFAULT_AUTOWRAP,
  layoutRichTextRuns,
  richTextLabelTextTheme,
  shapeRichText,
  styledTextRuns,
  underlineRectPx,
  type RichTextImagePlacement,
  type RichTextRunPlacement,
  type StyledTextRun,
} from './nativeSolver';
import { resolveRichTextFaces } from './styleFaces';
import { shapeBesideScrollBar } from './scrollBar';
import { countedCharacters, richTextReveal, truncateRunsToCharacters } from './visibleCharacters';
import type { RichTextLabelProperties } from './types';
import type { Rgba } from '../../../../godot/math/math';
import { VisibleCharactersBehavior } from '../../../../godot/text/textServerEnums';
import type { Rect2 } from '../../../../godot/math/rect2';
import type { NativeTheme } from '../../../../r3f/controls/native/nativeTheme';
import type { ResolvedTextTheme, TextOutlineTheme } from '../../../../r3f/controls/native/textTheme';
import { PositionedIcon } from '../../../../r3f/controls/native/PositionedIcon';

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
  const toItemLinear = useItemLinearColorOf();
  const { externalResources, internalResources } = resources;
  const { texture: rawTexture } = useTexture2D(spec.path, externalResources, internalResources);

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
  // `ControlQuad` decodes the sample itself, so the clone arrives as undecoded sRGB.
  const drawnTexture = useWindowedCanvas2DTexture(rawTexture, useResolvedTextureSampler(), regionWindow);

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
    <PositionedIcon
      rect={{ x: offsetXPx, y: offsetYPx, w: drawWidthPx, h: drawHeightPx }}
      texture={drawnTexture}
      color={toItemLinear(imageTint)}
      opacity={imageTint.a}
      renderOrder={renderOrder}
      canvasKey={renderOrder}
    />
  );
}

/** An `[hr]`: the theme's solid white `horizontal_rule` icon, stretched over the solved box and tinted. */
function RichTextRule({
  placement,
  tint,
  renderOrder,
}: {
  placement: RichTextImagePlacement;
  tint: Rgba;
  renderOrder: number;
}) {
  const toItemLinear = useItemLinearColorOf();
  const imageTint = multiplyModulate(tint, placement.spec.color);
  return (
    <ControlQuad
      renderOrder={renderOrder}
      width={placement.widthPx}
      height={placement.heightPx}
      color={toItemLinear(imageTint)}
      opacity={imageTint.a}
    />
  );
}

/** The outline of a run with none: `OutlinedTextRun` draws no ring at a size of 0, whatever the colour. */
const NO_OUTLINE: TextOutlineTheme = { sizePx: 0, color: { r: 0, g: 0, b: 0, a: 0 } };

/**
 * The run's outline as `_draw_line` tints it: the outline colour with the alpha of the run's colour
 * (`font_outline_color * Color(1, 1, 1, font_color.a)`, `rich_text_label.cpp:1457`), then the control tint.
 */
function runOutline(
  placement: Pick<RichTextRunPlacement, 'outline' | 'color'>,
  ownTint: Rgba
): TextOutlineTheme {
  const { sizePx, color } = placement.outline;
  if (sizePx <= 0) return NO_OUTLINE;
  return { sizePx, color: multiplyModulate(ownTint, { ...color, a: color.a * placement.color.a }) };
}

interface RichTextBodyProps extends NativeControlComponentProps {
  /** What a `TextRun` clips to: the inherited planes, or this control's rect merged onto them. */
  clippingPlanes: readonly THREE.Plane[];
}

/**
 * The text of `solveNode` shaped to wrap in `rect`, beside the scrollbar where there is one. The
 * faces are read in the render body, not in a `useMemo`: see Label's Component.tsx.
 */
function useShapedRichText(
  solveNode: SolveNode,
  props: RichTextLabelProperties,
  rect: Rect2,
  theme: NativeTheme,
  textTheme: ResolvedTextTheme
) {
  const runsAt = useCallback(
    (wrapWidthPx: number) =>
      styledTextRuns(solveNode, props, textTheme.color, textTheme.fontSizePx, theme.fontSize, wrapWidthPx),
    [solveNode, props, textTheme.color, textTheme.fontSizePx, theme.fontSize]
  );
  // RichTextLabel's own default is WORD_SMART (`rich_text_label.h:557`), not Label's OFF.
  const autowrapMode = clampAutowrapMode(props.autowrapMode, RICH_TEXT_LABEL_DEFAULT_AUTOWRAP);
  // The styles in use do not depend on the wrap width.
  const runsAtRectWidth = useMemo(() => runsAt(rect.w), [runsAt, rect.w]);
  const faces = resolveRichTextFaces(solveNode, runsAtRectWidth);
  const { normal, bold, italic, boldItalic } = faces;
  const { rtl } = solveNode;
  const box = useMemo(
    () => ({
      w: rect.w,
      h: rect.h,
      scrollActive: props.scrollActive,
      scrollFollowing: props.scrollFollowing,
      scrollFollowingVisibleCharacters: props.scrollFollowingVisibleCharacters,
      rtl,
    }),
    [rect.w, rect.h, props.scrollActive, props.scrollFollowing, props.scrollFollowingVisibleCharacters, rtl]
  );

  const shapeAtWidth = useCallback(
    (shapedRuns: StyledTextRun[], boxWidthPx: number) =>
      shapeRichText(
        shapedRuns,
        { normal, bold, italic, boldItalic },
        {
          fontSizePx: textTheme.fontSizePx,
          boxWidthPx,
          autowrapMode,
          tabSize: props.tabSize,
          autowrapTrimFlags: props.autowrapTrimFlags,
          localizeNumeralSystem: props.localizeNumeralSystem,
        }
      ),
    [
      normal,
      bold,
      italic,
      boldItalic,
      textTheme.fontSizePx,
      autowrapMode,
      props.tabSize,
      props.autowrapTrimFlags,
      props.localizeNumeralSystem,
    ]
  );

  const shaped = useMemo(
    () =>
      shapeBesideScrollBar(
        (wrapWidthPx) => {
          const runs = wrapWidthPx === rect.w ? runsAtRectWidth : runsAt(wrapWidthPx);
          return { runs, layout: shapeAtWidth(runs, wrapWidthPx) };
        },
        box,
        theme
      ),
    [runsAt, runsAtRectWidth, rect.w, shapeAtWidth, box, theme]
  );

  const { visibleCharacters, visibleRatio, visibleRatioDrives, visibleCharactersBehavior } = props;
  const reveal = useMemo(() => {
    // Without a budget the count is unread, so a label that shows everything skips it.
    if ((visibleCharacters === undefined || visibleCharacters < 0) && !visibleRatioDrives) return undefined;
    return richTextReveal(
      { visibleCharacters, visibleRatio, visibleRatioDrives, visibleCharactersBehavior },
      rtl,
      countedCharacters(shaped.runs)
    );
  }, [visibleCharacters, visibleRatio, visibleRatioDrives, visibleCharactersBehavior, rtl, shaped.runs]);

  // Before Shaping draws a prefix shaped on its own, so a typewriter reveal wraps as it grows. Only
  // this prefix depends on the reveal: the full shape above, which the heights and the bar read, does not.
  const isBeforeShaping = reveal?.behavior === VisibleCharactersBehavior.VC_CHARS_BEFORE_SHAPING;
  const shown = useMemo(() => {
    if (!reveal || !isBeforeShaping) return undefined;
    const { runs, layout, wrapWidthPx } = shaped;
    const shownRuns = truncateRunsToCharacters(runs, reveal.characters);
    // A cut that keeps the text whole returns the same runs, so its layout is reused.
    const isUncut = shownRuns === runs;
    return {
      runs: shownRuns,
      layout: isUncut ? layout : shapeAtWidth(shownRuns, wrapWidthPx),
    };
  }, [shaped, reveal, isBeforeShaping, shapeAtWidth]);

  return { ...shaped, shown, isBeforeShaping, reveal };
}

/** The lines and images of a RichTextLabel, and its scrollbar. A `ControlQuad` reads its clip from context, a `TextRun` from `clippingPlanes`. */
function RichTextBody({
  solveNode,
  tint,
  rect,
  renderOrder,
  slot,
  theme,
  snapToPixels,
  clippingPlanes,
}: RichTextBodyProps) {
  const props = painterView<RichTextLabelProperties>(solveNode);
  const toItemLinear = useItemLinearColorOf();
  const textTheme = useMemo(
    () => richTextLabelTextTheme(solveNode, props, { theme }),
    [solveNode, props, theme]
  );

  const {
    runs,
    layout,
    shown,
    isBeforeShaping,
    contentHeightPx,
    reveal,
    wrapWidthPx,
    textOriginXPx,
    scrollOffsetPx,
    scrollBar,
  } = useShapedRichText(solveNode, props, rect, theme, textTheme);

  // The alignment property and the `[center]`/`[right]`/`[left]`/`[fill]` tags
  // (`rich_text_label.cpp:5681-5696`) resolve through one `_find_alignment`
  // port. A FILL paragraph fits the text rect by `justification_flags`.
  const placements = useMemo(
    () =>
      layoutRichTextRuns(shown?.runs ?? runs, shown?.layout ?? layout, {
        boxWidthPx: wrapWidthPx,
        boxHeightPx: rect.h,
        scrollOffsetPx,
        horizontalAlignment: props.horizontalAlignment,
        verticalAlignment: props.verticalAlignment,
        reveal,
        fullText: isBeforeShaping ? { heightPx: contentHeightPx, lineCount: layout.lines.length } : undefined,
      }),
    [
      runs,
      layout,
      shown,
      isBeforeShaping,
      contentHeightPx,
      reveal,
      wrapWidthPx,
      rect.h,
      scrollOffsetPx,
      props.horizontalAlignment,
      props.verticalAlignment,
    ]
  );

  return (
    <>
      <CanvasItemGroup position={[textOriginXPx, 0, 0]}>
        {placements.map((placement, index) => {
          const y = placement.lineTopPx;
          if (placement.image) {
            return (
              <CanvasItemGroup
                key={index}
                position={[placement.lineOffsetXPx + placement.image.xPx, -(y + placement.image.yPx), 0]}
              >
                {placement.image.spec.solid ? (
                  <RichTextRule placement={placement.image} tint={tint.own} renderOrder={renderOrder} />
                ) : (
                  <RichTextImage
                    placement={placement.image}
                    tint={tint.own}
                    resources={solveNode.resources}
                    renderOrder={renderOrder}
                  />
                )}
              </CanvasItemGroup>
            );
          }
          // `lineTopPx` sums the earlier lines' heights, since font sizes vary by line.
          // The tint multiplies in sRGB and `<TextRun>` converts once.
          const runTint = multiplyModulate(tint.own, placement.color);
          const outline = runOutline(placement, tint.own);
          // `[u]` is a stroke on the line's baseline with the paragraph's metrics,
          // snapped to whole pixel rows, at `underline_alpha` times the opacity.
          const underline = placement.underline
            ? underlineRectPx(
                placement.layout.lines[0]!.glyphs,
                placement.layout.baselineOffsetPx,
                placement.underline
              )
            : null;
          return (
            <CanvasItemGroup key={index} position={[placement.lineOffsetXPx, -y, 0]}>
              <OutlinedTextRun
                layout={placement.layout}
                outline={outline}
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
                    color={toItemLinear(runTint)}
                    opacity={runTint.a * RICH_TEXT_LABEL_UNDERLINE_ALPHA}
                    renderOrder={renderOrder}
                  />
                </CanvasItemGroup>
              )}
            </CanvasItemGroup>
          );
        })}
      </CanvasItemGroup>
      {scrollBar && (
        // `vscroll` is an `INTERNAL_MODE_FRONT` child (`rich_text_label.cpp:8208`): it paints
        // over the text, under any regular child.
        <ScrollBarChrome
          bar={scrollBar}
          track={theme.widgets.scrollBar.scrollVertical}
          grabber={theme.widgets.scrollBar.grabber}
          color={tint.own}
          chromeSlot={slot}
          snapToPixels={snapToPixels}
        />
      )}
    </>
  );
}

/** `clip_contents` clips to the control's own rect, merged onto the inherited clip (`control.cpp:3948`). */
function ClippedRichTextLabel(props: NativeControlComponentProps) {
  const { rect } = props;
  const ownRect = useMemo(() => ({ x: 0, y: 0, w: rect.w, h: rect.h }), [rect.w, rect.h]);
  const { anchorRef, clippingPlanes, clip } = useWorldClipPlanes(ownRect);
  return (
    <CanvasItemGroup ref={anchorRef}>
      <ControlClipProvider value={clip}>
        <RichTextBody {...props} clippingPlanes={clippingPlanes} />
      </ControlClipProvider>
    </CanvasItemGroup>
  );
}

function UnclippedRichTextLabel(props: NativeControlComponentProps) {
  return <RichTextBody {...props} clippingPlanes={useControlClipPlanes()} />;
}

/** The painter. `clip_contents` is true by default for this node (`rich_text_label.cpp:8225`). */
export function RichTextLabel(props: NativeControlComponentProps) {
  const { clipContents } = painterView<RichTextLabelProperties>(props.solveNode);
  return clipContents ? <ClippedRichTextLabel {...props} /> : <UnclippedRichTextLabel {...props} />;
}
