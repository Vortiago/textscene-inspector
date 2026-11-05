/**
 * `<Button>`, the native (WebGL canvas) painter for `Button`: StyleBox chrome unless
 * `flat`, an aligned label and an optional icon, laid out by `buttonBase.ts`. Draw state
 * comes only from `disabled`: a static viewer has no hover, pressed or focus.
 * `ControlCanvasWalker` owns `visible`, the children and the transform.
 */
import { useMemo } from 'react';
import { sizeWithArea } from '../../../../resources/textures/textureSize';
import { CanvasItemGroup } from '../../../../r3f/components/CanvasItemGroup';
import type { NativeControlComponentProps } from '../../../../r3f/controls/ControlComponentRegistry';
import { painterView } from '../../../../r3f/controls/native/solveTree';
import { useGodotLinearColor } from '../../../../r3f/godotColor';
import { useTexture2D } from '../../../../resources/useTexture2D';
import { useOwnerCanvas2DTexture } from '../../../../r3f/canvas2DTextureDecode';
import { StyleBoxQuad } from '../../../../r3f/controls/native/StyleBoxQuad';
import { ControlQuad } from '../../../../r3f/controls/native/controlQuad';
import { useControlClipPlanes } from '../../../../r3f/controls/native/controlClipping';
import {
  hasOutlineRing,
  OutlinedTextRun,
  useTintedTextOutline,
} from '../../../../r3f/controls/native/text/OutlinedTextRun';
import {
  clampAutowrapMode,
  infersRtl,
  shapedTextSizeWidthPx,
  soloLineLayout,
  type TextLayoutResult,
} from '../../../../r3f/controls/native/text/textLayout';
import { overrunFlagsForBehavior, trimLayoutToWidth } from '../../../../r3f/controls/native/text/textOverrun';
import { isDrawnRtl } from '../../../../r3f/controls/native/text/textBidiOptions';
import { useControlBidiOptions } from '../../../../r3f/controls/native/text/useControlBidiOptions';
import { resolveNodeFontMetrics } from '../../../../r3f/controls/native/text/resolveNodeFontMetrics';
import {
  resolveButtonDrawState,
  pickButtonStyleBox,
  tintColor,
  layoutButtonContent,
  buttonTextAlignShiftPx,
  swapAlignmentSide,
} from '../../../../r3f/controls/native/buttonBase';
import { HorizontalAlignment, VerticalAlignment } from '../../../../godot/math/alignment';
import { BUTTON_THEME_FONT_KEY, buttonLabelShape, buttonTextTheme, buttonIconColor } from './nativeSolver';
import type { ButtonProperties } from './types';
import type { Vector2 } from '../../../../godot/math/vector';
import { AutowrapMode, OverrunBehavior } from '../../../../godot/text/textServerEnums';

export function Button({ solveNode, tint, rect, renderOrder, theme }: NativeControlComponentProps) {
  const props = painterView<ButtonProperties>(solveNode);
  const state = resolveButtonDrawState(props.disabled);

  const baseStyleBox = pickButtonStyleBox(solveNode.styleBoxes, theme.widgets.button, state, solveNode.rtl);

  // `renderOrder` and the clip planes reach every mesh. `<TextRun>` builds its own
  // ShaderMaterial, so it takes the planes explicitly, or the label escapes an
  // enclosing ScrollContainer's clip.
  const clippingPlanes = useControlClipPlanes();

  // `tint.own` is raw sRGB. It goes to the chrome as is, and multiplies into the font
  // and icon colours before each one's single sRGB-to-linear conversion.
  const text = props.text ?? '';
  const hasText = text.length > 0;
  const { fontSizePx, color: baseFontColor } = buttonTextTheme(solveNode, props, state, { theme });
  const tintedFontColor = useMemo(() => tintColor(baseFontColor, tint.own), [baseFontColor, tint.own]);
  const textOutline = useTintedTextOutline(solveNode, tint.own);

  const fontMetrics = resolveNodeFontMetrics(solveNode, BUTTON_THEME_FONT_KEY);
  // Pass 1, unwrapped: what the icon's own reservation is measured against. It is the
  // **solve handoff** the minimum-size solver calls too, so one shaping sizes both.
  const unwrapped: TextLayoutResult | null = buttonLabelShape(solveNode, theme);

  // The node's own scope, not the ambient provider's: a Button that arrived
  // through an instanced sub-scene names ids from that scene.
  const { externalResources, internalResources } = solveNode.resources;
  // `useTexture2D`, not the path-only resolver: an icon may be an inline
  // procedural texture, which has no path to load from.
  const { texture: iconSource, size: iconSize } = useTexture2D(
    props.icon,
    externalResources,
    internalResources
  );
  // NoColorSpace: the 2D canvas's hardware filter blends undecoded sRGB
  // bytes (`canvas2DTextureDecode.ts`). `ControlQuad` decodes the
  // already-filtered sample once it sees this tag.
  const iconTexture = useOwnerCanvas2DTexture(iconSource);

  const iconNaturalSize = useMemo(
    () => (props.icon && iconTexture ? sizeWithArea(iconSize) : null),
    [props.icon, iconTexture, iconSize]
  );

  const baseIconColor = buttonIconColor(solveNode.colors, state);
  const tintedIconColorSrgb = useMemo(() => tintColor(baseIconColor, tint.own), [baseIconColor, tint.own]);
  const iconLinearColor = useGodotLinearColor(tintedIconColorSrgb);

  const contentInput = useMemo(
    () => ({
      rectSize: { x: rect.w, y: rect.h },
      styleMargin: baseStyleBox.contentMargin,
      hSeparation: solveNode.constants.h_separation ?? theme.separation,
      iconMaxWidth: solveNode.constants.icon_max_width ?? 0,
      // Aligned against the ceiled text width (`scene/gui/button.cpp:343,349`).
      textAlignment: props.alignment ?? HorizontalAlignment.HORIZONTAL_ALIGNMENT_CENTER,
      iconAlignment: props.iconAlignment ?? HorizontalAlignment.HORIZONTAL_ALIGNMENT_LEFT,
      verticalIconAlignment: props.verticalIconAlignment ?? VerticalAlignment.VERTICAL_ALIGNMENT_CENTER,
      expandIcon: props.expandIcon === true,
      iconNaturalSize,
      hasText,
      rtl: solveNode.rtl,
    }),
    [
      rect.w,
      rect.h,
      baseStyleBox.contentMargin,
      solveNode.constants,
      props.alignment,
      props.iconAlignment,
      props.verticalIconAlignment,
      props.expandIcon,
      iconNaturalSize,
      hasText,
      theme.separation,
      solveNode.rtl,
    ]
  );

  /**
   * The ceiled shaped width, not the raw pen advance: Godot's draw path (`button.cpp:343,349`)
   * reads the same `text_buf->get_size()` as the minimum size. The height needs no ceil: the
   * line pitch sums independently ceiled ascent and descent and an integral theme spacing.
   */
  const naturalSize = (l: TextLayoutResult | null): Vector2 =>
    l ? { x: shapedTextSizeWidthPx(l.widthPx), y: l.heightPx } : { x: 0, y: 0 };

  // `button.cpp:262-276`: the same RTL side swap `layoutButtonContent` makes internally.
  const textAlignment = solveNode.rtl
    ? swapAlignmentSide(props.alignment ?? HorizontalAlignment.HORIZONTAL_ALIGNMENT_CENTER)
    : (props.alignment ?? HorizontalAlignment.HORIZONTAL_ALIGNMENT_CENTER);
  // `button.cpp:428-432` re-shapes a wrapping label at the width the unwrapped pass measured:
  // `is_clipped` is true under autowrap (`:332`), so the icon's reservation does not move
  // with the text. Godot reaches the same state over two frames.
  const wraps =
    clampAutowrapMode(props.autowrapMode, AutowrapMode.AUTOWRAP_OFF) !== AutowrapMode.AUTOWRAP_OFF;
  const drawableWidthPx = layoutButtonContent({
    ...contentInput,
    textNaturalSize: naturalSize(unwrapped),
    isTextRtl: infersRtl(unwrapped),
  }).drawableSize.x;
  const layout: TextLayoutResult | null = wraps
    ? buttonLabelShape(solveNode, theme, Math.ceil(Math.max(1, drawableWidthPx)))
    : unwrapped;
  const content = useMemo(
    () =>
      layoutButtonContent({
        ...contentInput,
        textNaturalSize: naturalSize(layout),
        isTextRtl: infersRtl(layout),
      }),
    [contentInput, layout]
  );

  const overrunFlags = useMemo(
    () => overrunFlagsForBehavior(props.overrunBehavior ?? OverrunBehavior.OVERRUN_NO_TRIMMING),
    [props.overrunBehavior]
  );
  const isLineDrawnRtl = isDrawnRtl(useControlBidiOptions(props, solveNode));
  const trimWidthPx = useMemo(() => {
    const customElementWidth = rect.w - baseStyleBox.contentMargin.left - baseStyleBox.contentMargin.right;
    const iconReserve =
      content.icon &&
      (props.iconAlignment ?? HorizontalAlignment.HORIZONTAL_ALIGNMENT_LEFT) !==
        HorizontalAlignment.HORIZONTAL_ALIGNMENT_CENTER
        ? content.icon.rect.w + (solveNode.constants.h_separation ?? theme.separation)
        : 0;
    // button.cpp:424 `text_buf_width = ceil(MAX(1, drawable_size_remained.width))`. The icon's
    // computed reservation, `content.icon.rect.w`, keeps this in step with `layoutButtonContent`.
    return Math.ceil(Math.max(1, customElementWidth - iconReserve));
  }, [
    rect.w,
    baseStyleBox.contentMargin,
    content.icon,
    props.iconAlignment,
    solveNode.constants,
    theme.separation,
  ]);
  // The fill reads the set direction and the outline the inferred one (`shaped_text_draw` and
  // `shaped_text_draw_outline`), so an AUTO Hebrew label trims to two different shapes.
  const trimmed = useMemo(() => {
    // `TextParagraph::_shape_lines` trims each row of an unwrapped buffer, and no row of a wrapped
    // one, since Button hides no line (`text_paragraph.cpp:228-262,282-293`).
    if (!layout || !overrunFlags.trim || wraps) return { fill: layout, outline: layout };
    const trim = (drawsRtl: boolean) =>
      trimLayoutToWidth(layout, trimWidthPx, overrunFlags, { fontMetrics, fontSizePx, isDrawnRtl: drawsRtl });
    const fill = trim(isLineDrawnRtl);
    const isOutlineDrawnRtl = infersRtl(layout);
    const hasOwnOutlineShape = hasOutlineRing(textOutline) && isOutlineDrawnRtl !== isLineDrawnRtl;
    return { fill, outline: hasOwnOutlineShape ? trim(isOutlineDrawnRtl) : fill };
  }, [layout, overrunFlags, wraps, trimWidthPx, fontMetrics, fontSizePx, isLineDrawnRtl, textOutline]);
  const trimmedLayout = trimmed.fill;

  // One layout object per row, so a row's runs keep their meshes across renders.
  const lineLayouts = useMemo(
    () => trimmedLayout?.lines.map((line) => soloLineLayout(line, trimmedLayout)) ?? [],
    [trimmedLayout]
  );
  // `content.text.offset.x` holds this shift of the untrimmed `layout`; each row backs it out.
  const untrimmedShiftPx = content.text
    ? buttonTextAlignShiftPx(naturalSize(layout).x, content.drawableSize.x, textAlignment, infersRtl(layout))
    : 0;
  // Only a trimmed layout has an outline shape of its own.
  const outlineLineLayouts = useMemo(() => {
    const { outline, fill } = trimmed;
    return outline && outline !== fill
      ? outline.lines.map((line) => soloLineLayout(line, outline))
      : undefined;
  }, [trimmed]);

  return (
    <>
      {!props.flat && (
        <StyleBoxQuad styleBox={baseStyleBox} color={tint.own} rect={rect} renderOrder={renderOrder} />
      )}
      {content.icon && iconTexture && (
        <CanvasItemGroup position={[content.icon.rect.x, -content.icon.rect.y, 0]}>
          <ControlQuad
            renderOrder={renderOrder}
            width={content.icon.rect.w}
            height={content.icon.rect.h}
            color={iconLinearColor}
            opacity={tintedIconColorSrgb.a}
            map={iconTexture}
          />
        </CanvasItemGroup>
      )}
      {content.text !== null &&
        trimmedLayout &&
        trimmedLayout.lines.map((line, i) => (
          // `TextParagraph::draw` aligns each line on its own (`text_paragraph.cpp:887-922`),
          // so shorter rows re-centre. `content.text.offset.x` carries the shift of the untrimmed
          // `layout`, so that shift is backed out and each row's own put in its place.
          <CanvasItemGroup
            key={i}
            position={[
              content.text!.offset.x -
                untrimmedShiftPx +
                buttonTextAlignShiftPx(
                  shapedTextSizeWidthPx(line.widthPx),
                  content.drawableSize.x,
                  textAlignment,
                  line.isRtl === true
                ),
              -(content.text!.offset.y + i * trimmedLayout.linePitchPx),
              0,
            ]}
          >
            <OutlinedTextRun
              layout={lineLayouts[i]!}
              outlineLayout={outlineLineLayouts?.[i]}
              fontSizePx={fontSizePx}
              tint={tintedFontColor}
              outline={textOutline}
              clippingPlanes={clippingPlanes}
              renderOrder={renderOrder}
            />
          </CanvasItemGroup>
        ))}
    </>
  );
}
