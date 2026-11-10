/**
 * `<Button>`, the native (WebGL canvas) painter for `Button`: StyleBox chrome unless
 * `flat`, an aligned label and an optional icon, laid out by `buttonBase.ts`. Draw state
 * comes only from `disabled`: a static viewer has no hover, pressed or focus.
 * `ControlCanvasWalker` owns `visible`, the children and the transform.
 */
import { TextureQuad } from '../../../../r3f/controls/native/TextureQuad';
import { useMemo } from 'react';
import { sizeWithArea } from '../../../../resources/textures/textureSize';
import type { NativeControlComponentProps } from '../../../../r3f/controls/ControlComponentRegistry';
import { painterView } from '../../../../r3f/controls/native/solveTree';
import { useTexture2D } from '../../../../resources/useTexture2D';
import { useOwnerCanvas2DTexture } from '../../../../r3f/canvas2DTextureDecode';
import { StyleBoxQuad } from '../../../../r3f/controls/native/StyleBoxQuad';
import { useControlClipPlanes } from '../../../../r3f/controls/native/controlClipping';
import { ButtonLabel } from '../../../../r3f/controls/native/ButtonLabel';
import { useTintedTextOutline } from '../../../../r3f/controls/native/text/OutlinedTextRun';
import {
  clampAutowrapMode,
  infersRtl,
  shapedTextSizeWidthPx,
  type TextLayoutResult,
} from '../../../../r3f/controls/native/text/textLayout';
import { useControlBidiOptions } from '../../../../r3f/controls/native/text/useControlBidiOptions';
import {
  resolveButtonDrawState,
  pickButtonStyleBox,
  tintColor,
  layoutButtonContent,
  buttonTextBufWidthPx,
} from '../../../../r3f/controls/native/buttonBase';
import { HorizontalAlignment, VerticalAlignment } from '../../../../godot/math/alignment';
import {
  buttonLabelShape,
  buttonTextTheme,
  buttonIconColor,
  buttonFocusIconColor,
  isButtonFocusStyled,
} from './nativeSolver';
import type { ButtonProperties } from './types';
import type { Vector2 } from '../../../../godot/math/vector';
import { AutowrapMode } from '../../../../godot/text/textServerEnums';
import { useItemLinearColor } from '../../../../r3f/canvasItemModulate';

interface ButtonPainterProps extends NativeControlComponentProps {
  /** The theme font size and colour for the Control's own class (`default_theme.cpp`). */
  textTheme: typeof buttonTextTheme;
}

/** The painter every `Button` subclass that adds no draw code of its own shares. */
export function ButtonPainter({ solveNode, tint, rect, renderOrder, theme, textTheme }: ButtonPainterProps) {
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
  const { fontSizePx, color: baseFontColor } = textTheme(solveNode, props, state, { theme });
  const tintedFontColor = useMemo(() => tintColor(baseFontColor, tint.own), [baseFontColor, tint.own]);
  const textOutline = useTintedTextOutline(solveNode, tint.own);

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

  const isFocusStyled = isButtonFocusStyled(props, state);
  const baseIconColor = isFocusStyled
    ? buttonFocusIconColor(solveNode.colors)
    : buttonIconColor(solveNode.colors, state);
  const tintedIconColorSrgb = useMemo(() => tintColor(baseIconColor, tint.own), [baseIconColor, tint.own]);
  const iconLinearColor = useItemLinearColor(tintedIconColorSrgb);

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
    ? buttonLabelShape(solveNode, theme, buttonTextBufWidthPx(drawableWidthPx))
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

  const bidi = useControlBidiOptions(props, solveNode);

  return (
    <>
      {!props.flat && (
        <StyleBoxQuad styleBox={baseStyleBox} color={tint.own} rect={rect} renderOrder={renderOrder} />
      )}
      {props.hasFocus && (
        <StyleBoxQuad
          styleBox={solveNode.styleBoxes.focus ?? theme.widgets.button.focus}
          color={tint.own}
          rect={rect}
          renderOrder={renderOrder}
        />
      )}
      {content.icon && iconTexture && (
        <TextureQuad
          rect={{
            x: content.icon.rect.x,
            y: content.icon.rect.y,
            w: content.icon.rect.w,
            h: content.icon.rect.h,
          }}
          texture={iconTexture}
          color={iconLinearColor}
          opacity={tintedIconColorSrgb.a}
          renderOrder={renderOrder}
        />
      )}
      {content.labelBox && layout && (
        <ButtonLabel
          layout={layout}
          overrunBehavior={props.overrunBehavior}
          bidi={bidi}
          isWrapped={wraps}
          box={content.labelBox}
          fontSizePx={fontSizePx}
          tint={tintedFontColor}
          outline={textOutline}
          clippingPlanes={clippingPlanes}
          renderOrder={renderOrder}
        />
      )}
    </>
  );
}

export function Button(props: NativeControlComponentProps) {
  return <ButtonPainter {...props} textTheme={buttonTextTheme} />;
}
