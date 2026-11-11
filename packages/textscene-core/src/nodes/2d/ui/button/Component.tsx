/**
 * `<ButtonPainter>`, the native (WebGL canvas) painter of `Button` and of every class that extends it:
 * StyleBox chrome unless `flat`, the focus box, an optional icon and an aligned label, laid out by
 * `buttonBase.ts` (`Button::_notification`, `button.cpp:203-460`). A subclass draws its own element over
 * it. Draw state comes from `disabled` and `button_pressed`: a static viewer has no hover.
 * `ControlCanvasWalker` owns `visible`, the children and the transform.
 */
import { canvasPieceSlot, wholeKeySlot } from '../../../../r3f/canvasItemState';
import { useMemo } from 'react';
import type { NativeControlComponentProps } from '../../../../r3f/controls/ControlComponentRegistry';
import { painterView } from '../../../../r3f/controls/native/solveTree';
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
  const { state, box } = buttonStyle(solveNode, theme);

  // `renderOrder` and the clip planes reach every mesh. `<TextRun>` builds its own
  // ShaderMaterial, so it takes the planes explicitly, or the label escapes an
  // enclosing ScrollContainer's clip.
  const clippingPlanes = useControlClipPlanes();

  // `tint.own` is raw sRGB. It goes to the chrome as is, and multiplies into the font
  // and icon colours before each one's single sRGB-to-linear conversion.
  const { fontSizePx, color: baseFontColor } = buttonTextTheme(
    solveNode,
    props,
    state,
    { theme },
    buttonClass
  );
  const tintedFontColor = useMemo(() => tintColor(baseFontColor, tint.own), [baseFontColor, tint.own]);
  const textOutline = useTintedTextOutline(solveNode, tint.own);

  // Pass 1, unwrapped: what the icon's own reservation is measured against. It is the
  // **solve handoff** the minimum-size solver calls too, so one shaping sizes both. The node is
  // rebuilt when a font settles (`solveHandoff.ts`), so its identity keys the shape.
  const unwrapped = useMemo(
    () => buttonLabelShape(solveNode, theme, buttonClass),
    [solveNode, theme, buttonClass]
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
  const wraps = isButtonAutowrapped(props);
  const wrapWidthPx = wraps ? wrappedLabelWidthPx(facts, unwrapped) : 0;
  const layout = useMemo(
    () => (wraps ? buttonLabelShape(solveNode, theme, buttonClass, wrapWidthPx) : unwrapped),
    [wraps, solveNode, theme, buttonClass, wrapWidthPx, unwrapped]
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

/**
 * The draw-order key of what a subclass draws after `Button::_notification`: the second of two pieces,
 * two thirds into the Control's unit. The label's outline and fill sit at `renderOrder` and half a unit
 * above it (`textLayerRenderOrder`), and the next Control starts a whole unit above.
 */
export function buttonOverlayRenderOrder(renderOrder: number): number {
  return canvasPieceSlot(wholeKeySlot(renderOrder), 1, 2).key;
}

export function Button(props: NativeControlComponentProps) {
  return <ButtonPainter {...props} buttonClass={BUTTON_CLASS} />;
}
