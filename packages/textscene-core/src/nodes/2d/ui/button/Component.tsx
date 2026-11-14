/**
 * `<ButtonPainter>`, the native (WebGL canvas) painter of `Button` and of every class that extends it:
 * what `Button::_notification` draws (`button.cpp:203-460`), laid out by `buttonBase.ts`. A subclass draws
 * its own element over it with `<ButtonOverlayIcon>`. A static viewer has no hover draw state.
 */
import { useMemo } from 'react';
import type * as THREE from 'three';
import type { Rect2 } from '../../../../godot/math/rect2';
import type { Rgba } from '../../../../godot/math/math';
import { canvasPieceSlot, wholeKeySlot } from '../../../../r3f/canvasItemState';
import type { NativeControlComponentProps } from '../../../../r3f/controls/ControlComponentRegistry';
import { painterView } from '../../../../r3f/controls/native/solveTree';
import { requiredThemeItem } from '../../../../r3f/controls/native/themeItems';
import { useNodeIcon } from '../../../../r3f/controls/native/useIconTexture';
import { useIconModulate, useIconRefTexture } from '../../../../r3f/controls/native/useButtonIcon';
import { PositionedIcon } from '../../../../r3f/controls/native/PositionedIcon';
import { StyleBoxQuad } from '../../../../r3f/controls/native/StyleBoxQuad';
import { useControlClipPlanes } from '../../../../r3f/controls/native/controlClipping';
import { ButtonLabel } from '../../../../r3f/controls/native/ButtonLabel';
import { useTintedTextOutline } from '../../../../r3f/controls/native/text/OutlinedTextRun';
import { infersRtl } from '../../../../r3f/controls/native/text/textLayout';
import { useControlBidiOptions } from '../../../../r3f/controls/native/text/useControlBidiOptions';
import {
  tintColor,
  layoutButtonContent,
  isButtonAutowrapped,
  labelNaturalSize,
  wrappedLabelWidthPx,
} from '../../../../r3f/controls/native/buttonBase';
import {
  BUTTON_CLASS,
  buttonContentFacts,
  buttonIconColor,
  buttonLabelShape,
  buttonShown,
  buttonStyle,
  buttonTextTheme,
  type ButtonClass,
} from './nativeSolver';
import type { ButtonProperties } from './types';

interface ButtonPainterProps extends NativeControlComponentProps {
  /** What the node's class changes of Button. */
  buttonClass: ButtonClass;
}

/** Draws what `Button::_notification` draws, for a Button of any class. */
export function ButtonPainter({
  solveNode,
  tint,
  rect,
  renderOrder,
  theme,
  buttonClass,
}: ButtonPainterProps) {
  const props = painterView<ButtonProperties>(solveNode);
  const { state, box } = buttonStyle(solveNode);

  // `renderOrder` and the clip planes reach every mesh. `<TextRun>` builds its own
  // ShaderMaterial, so it takes the planes explicitly, or the label escapes an
  // enclosing ScrollContainer's clip.
  const clippingPlanes = useControlClipPlanes();

  // `tint.own` is raw sRGB. It goes to the chrome as is, and multiplies into the font
  // and icon colours before each one's single sRGB-to-linear conversion.
  const { fontSizePx, color: baseFontColor } = buttonTextTheme(solveNode, props, state);
  const tintedFontColor = useMemo(() => tintColor(baseFontColor, tint.own), [baseFontColor, tint.own]);
  const textOutline = useTintedTextOutline(solveNode, tint.own);

  // Pass 1, unwrapped: the **solve handoff** the minimum-size solver calls too, so one shaping sizes
  // both. The node is rebuilt when a font settles (`solveHandoff.ts`), so its identity keys the shape.
  // A wrapping label reads it only for an expanded icon's height, as `tentativeWrapWidthPx` does.
  const wraps = isButtonAutowrapped(props);
  const needsUnwrapped = !wraps || props.expandIcon === true;
  const unwrapped = useMemo(
    () => (needsUnwrapped ? buttonLabelShape(solveNode, buttonClass) : null),
    [needsUnwrapped, solveNode, buttonClass]
  );

  const ownIcon = buttonShown(buttonClass, props).icon;
  const ownIconTexture = useIconRefTexture(solveNode, ownIcon);
  // A theme icon the Control gave this Button: the vendored default is a 16x16 SVG whose size
  // `textureSize` already holds, since the loader returns a blank texture before the decode.
  const givenIcon = solveNode.syntheticDraw?.themedIcon;
  // Without either, the theme icon `icon` stands in for the property (`button.cpp:224-227`).
  const themedIconName = givenIcon?.name ?? (ownIcon ? undefined : 'icon');
  const themedIconTexture = useNodeIcon(
    themedIconName === undefined ? undefined : solveNode.icons[themedIconName],
    givenIcon?.vendoredUrl ?? null
  );
  const iconTexture = themedIconName === undefined ? ownIconTexture : themedIconTexture;
  const iconModulate = useIconModulate(buttonIconColor(solveNode.colors, state, props), tint.own);

  const facts = useMemo(
    () => buttonContentFacts(solveNode, theme, buttonClass, { x: rect.w, y: rect.h }),
    [solveNode, theme, buttonClass, rect.w, rect.h]
  );

  // `button.cpp:428-432` re-shapes a wrapping label at the width the unwrapped pass measured:
  // `is_clipped` is true under autowrap (`:332`), so the icon's reservation does not move
  // with the text. Godot reaches the same state over two frames.
  const wrapWidthPx = wraps ? wrappedLabelWidthPx(facts, unwrapped) : 0;
  const layout = useMemo(
    () => (wraps ? buttonLabelShape(solveNode, buttonClass, wrapWidthPx) : unwrapped),
    [wraps, solveNode, buttonClass, wrapWidthPx, unwrapped]
  );
  const content = useMemo(
    () =>
      layoutButtonContent({
        ...facts,
        textNaturalSize: labelNaturalSize(layout),
        isTextRtl: infersRtl(layout),
      }),
    [facts, layout]
  );

  const bidi = useControlBidiOptions(props, solveNode);

  return (
    <>
      {!props.flat && <StyleBoxQuad styleBox={box} color={tint.own} rect={rect} renderOrder={renderOrder} />}
      {props.hasFocus && (
        <StyleBoxQuad
          styleBox={requiredThemeItem(solveNode.styleBoxes, 'focus')}
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

interface ButtonOverlayIconProps {
  /** The icon's rect in the Button's top-left coordinates. */
  rect: Rect2;
  texture: THREE.Texture | null;
  /** The theme colour the subclass draws the icon in, before the item's tint. */
  color: Rgba;
  tint: Rgba;
  renderOrder: number;
}

/**
 * The icon a subclass draws after `Button::_notification`, over the label. Its draw-order key is the
 * second of two pieces of the Control's unit: the label's outline and fill sit at `renderOrder` and half
 * a unit above it (`textLayerRenderOrder`), and the next Control starts a whole unit above.
 */
export function ButtonOverlayIcon({ rect, texture, color, tint, renderOrder }: ButtonOverlayIconProps) {
  const drawn = useIconModulate(color, tint);
  return (
    <PositionedIcon
      rect={rect}
      texture={texture}
      color={drawn.color}
      opacity={drawn.opacity}
      renderOrder={canvasPieceSlot(wholeKeySlot(renderOrder), 1, 2).key}
    />
  );
}

export function Button(props: NativeControlComponentProps) {
  return <ButtonPainter {...props} buttonClass={BUTTON_CLASS} />;
}
