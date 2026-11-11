/**
 * `<Button>`, the native (WebGL canvas) painter for `Button`: StyleBox chrome unless
 * `flat`, an aligned label and an optional icon, laid out by `buttonBase.ts`. Draw state
 * comes only from `disabled`: a static viewer has no hover, pressed or focus.
 * `ControlCanvasWalker` owns `visible`, the children and the transform.
 */
import { useMemo } from 'react';
import type { NativeControlComponentProps } from '../../../../r3f/controls/ControlComponentRegistry';
import { painterView } from '../../../../r3f/controls/native/solveTree';
import { useNodeIcon } from '../../../../r3f/controls/native/useIconTexture';
import { useIconModulate, useIconTexture } from '../../../../r3f/controls/native/useButtonIcon';
import { buttonBoxesOf } from '../../../../r3f/controls/native/defaultThemeItems';
import { PositionedIcon } from '../../../../r3f/controls/native/PositionedIcon';
import { StyleBoxQuad } from '../../../../r3f/controls/native/StyleBoxQuad';
import { useControlClipPlanes } from '../../../../r3f/controls/native/controlClipping';
import { ButtonLabel } from '../../../../r3f/controls/native/ButtonLabel';
import { useTintedTextOutline } from '../../../../r3f/controls/native/text/OutlinedTextRun';
import { infersRtl, type TextLayoutResult } from '../../../../r3f/controls/native/text/textLayout';
import { useControlBidiOptions } from '../../../../r3f/controls/native/text/useControlBidiOptions';
import {
  resolveToggleDrawState,
  pickButtonStyleBox,
  tintColor,
  layoutButtonContent,
  isButtonAutowrapped,
  isButtonTextClipped,
  labelNaturalSize,
  wrappedLabelWidthPx,
} from '../../../../r3f/controls/native/buttonBase';
import {
  buttonLabelShape,
  buttonTextTheme,
  buttonIconColor,
  buttonFocusIconColor,
  isButtonFocusStyled,
  buttonContentInput,
} from './nativeSolver';
import type { ButtonProperties } from './types';

interface ButtonPainterProps extends NativeControlComponentProps {
  /** The theme font size and colour for the Control's own class (`default_theme.cpp`). */
  textTheme: typeof buttonTextTheme;
}

/** The painter every `Button` subclass that adds no draw code of its own shares. */
export function ButtonPainter({ solveNode, tint, rect, renderOrder, theme, textTheme }: ButtonPainterProps) {
  const props = painterView<ButtonProperties>(solveNode);
  const state = resolveToggleDrawState(props.disabled, props.buttonPressed);

  const baseStyleBox = pickButtonStyleBox(
    solveNode.styleBoxes,
    buttonBoxesOf(solveNode, theme),
    state,
    solveNode.rtl
  );

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

  const ownIconTexture = useIconTexture(solveNode, props.icon);
  // A theme icon the Control gave this Button: the vendored default is a 16x16 SVG whose size
  // `textureSize` already holds, since the loader returns a blank texture before the decode.
  const themedIcon = solveNode.syntheticDraw?.themedIcon;
  const themedIconTexture = useNodeIcon(
    themedIcon && solveNode.icons[themedIcon.name],
    themedIcon?.vendoredUrl ?? null
  );
  const iconTexture = themedIcon ? themedIconTexture : ownIconTexture;

  // The solver's size, loaded or not, so the layout agrees with the minimum size on every frame.
  const iconNaturalSize = solveNode.textureSize;

  const isFocusStyled = isButtonFocusStyled(props, state);
  const iconModulate = useIconModulate(
    isFocusStyled ? buttonFocusIconColor(solveNode.colors) : buttonIconColor(solveNode.colors, state),
    tint.own
  );

  const isClipped = isButtonTextClipped(props);
  const { alignment, iconAlignment, verticalIconAlignment, expandIcon } = props;
  const contentInput = useMemo(
    () =>
      buttonContentInput({
        alignment,
        iconAlignment,
        verticalIconAlignment,
        expandIcon,
        isClipped,
        constants: solveNode.constants,
        separationPx: theme.separation,
        rtl: solveNode.rtl,
        rectSize: { x: rect.w, y: rect.h },
        styleMargin: baseStyleBox.contentMargin,
        iconNaturalSize,
        hasText,
      }),
    [
      alignment,
      iconAlignment,
      verticalIconAlignment,
      expandIcon,
      isClipped,
      solveNode.constants,
      theme.separation,
      solveNode.rtl,
      rect.w,
      rect.h,
      baseStyleBox.contentMargin,
      iconNaturalSize,
      hasText,
    ]
  );

  // `button.cpp:428-432` re-shapes a wrapping label at the width the unwrapped pass measured:
  // `is_clipped` is true under autowrap (`:332`), so the icon's reservation does not move
  // with the text. Godot reaches the same state over two frames.
  const wraps = isButtonAutowrapped(props);
  const layout: TextLayoutResult | null = wraps
    ? buttonLabelShape(solveNode, theme, wrappedLabelWidthPx(contentInput, unwrapped))
    : unwrapped;
  const content = useMemo(
    () =>
      layoutButtonContent({
        ...contentInput,
        textNaturalSize: labelNaturalSize(layout),
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
      {content.icon && (
        <PositionedIcon
          rect={content.icon.rect}
          texture={iconTexture}
          color={iconModulate.color}
          opacity={iconModulate.opacity}
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
