/**
 * `<CheckButton>`, the native (WebGL canvas) painter: Button's own icon, the label, and a toggle-switch icon,
 * always drawn, at the content margin on the side opposite CheckBox's glyph. No chrome: every
 * StyleBox is the same `StyleBoxEmpty`. `ControlCanvasWalker` owns `visible`, the children and
 * the transform.
 */
import { useMemo } from 'react';
import type { NativeControlComponentProps } from '../../../../r3f/controls/ControlComponentRegistry';
import { painterView } from '../../../../r3f/controls/native/solveTree';
import { useControlClipPlanes } from '../../../../r3f/controls/native/controlClipping';
import { useCheckButtonIcon } from './useCheckButtonIcon';
import { ButtonLabel, useWrappingButtonLabelLayout } from '../../../../r3f/controls/native/ButtonLabel';
import { useTintedTextOutline } from '../../../../r3f/controls/native/text/OutlinedTextRun';
import { infersRtl } from '../../../../r3f/controls/native/text/textLayout';
import {
  BUTTON_ICON_SLOT_KEY,
  isButtonAutowrapped,
  labelNaturalSize,
  tintColor,
} from '../../../../r3f/controls/native/buttonBase';
import { useControlBidiOptions } from '../../../../r3f/controls/native/text/useControlBidiOptions';
import { PositionedIcon } from '../../../../r3f/controls/native/PositionedIcon';
import { useIconModulate, useOwnButtonTexture } from '../../../../r3f/controls/native/useButtonIcon';
import { buttonIconColor } from '../button/nativeSolver';
import {
  checkButtonCheckVOffset,
  checkButtonContentFacts,
  checkButtonIconColor,
  checkButtonDrawnIconSize,
  checkButtonFittedIconSize,
  checkButtonTextTheme,
  layoutCheckButtonContent,
  resolveCheckButtonDrawState,
  resolveCheckButtonIconKey,
  CHECKBUTTON_THEME_FONT_KEY,
} from './nativeSolver';
import type { CheckButtonProperties } from './types';

export function CheckButton({ solveNode, tint, rect, renderOrder, theme }: NativeControlComponentProps) {
  const props = painterView<CheckButtonProperties>(solveNode);
  const state = resolveCheckButtonDrawState(props);

  // `renderOrder` reaches every mesh. `<TextRun>` builds its own material, so it takes
  // the clip planes explicitly, while the icon quads read them themselves.
  const clippingPlanes = useControlClipPlanes();

  const toggleKey = resolveCheckButtonIconKey(props, solveNode.rtl);
  const toggleTexture = useCheckButtonIcon(solveNode, toggleKey);
  const toggleSize = useMemo(
    () => checkButtonFittedIconSize(solveNode, props.disabled === true),
    [solveNode, props.disabled]
  );
  const drawnToggleSize = useMemo(
    () => checkButtonDrawnIconSize(solveNode, toggleKey),
    [solveNode, toggleKey]
  );

  // Unlike CheckBox's fixed white, the toggle colour is a theme key a scene can override, so it
  // takes the tint before its one sRGB-to-linear conversion, as Button's icon does.
  const toggleModulate = useIconModulate(checkButtonIconColor(props, solveNode.colors), tint.own);
  const ownIconTexture = useOwnButtonTexture(solveNode, props.icon);
  const ownIconSize = solveNode.textureSlots[BUTTON_ICON_SLOT_KEY] ?? null;
  const ownIconModulate = useIconModulate(buttonIconColor(solveNode.colors, state), tint.own);

  const text = props.text ?? '';
  const { fontSizePx, color: baseFontColor } = checkButtonTextTheme(solveNode, props, state, { theme });
  const tintedFontColor = useMemo(() => tintColor(baseFontColor, tint.own), [baseFontColor, tint.own]);
  const textOutline = useTintedTextOutline(solveNode, tint.own);

  const bidi = useControlBidiOptions(props, solveNode);
  const facts = useMemo(
    () => checkButtonContentFacts(solveNode, props, { theme }, { x: rect.w, y: rect.h }, ownIconSize),
    [solveNode, props, theme, rect.w, rect.h, ownIconSize]
  );
  const layout = useWrappingButtonLabelLayout(
    solveNode,
    props,
    { themeFontKey: CHECKBUTTON_THEME_FONT_KEY, text, fontSizePx, bidi },
    facts
  );

  const content = useMemo(
    () =>
      layoutCheckButtonContent({
        content: { ...facts, textNaturalSize: labelNaturalSize(layout), isTextRtl: infersRtl(layout) },
        checkSize: toggleSize,
        checkVOffset: checkButtonCheckVOffset(solveNode.constants),
      }),
    [facts, layout, toggleSize, solveNode.constants]
  );

  // Button draws its icon and label first (`button.cpp:333-456`), then CheckButton its toggle.
  return (
    <>
      {content.icon && (
        <PositionedIcon
          rect={content.icon.rect}
          texture={ownIconTexture}
          color={ownIconModulate.color}
          opacity={ownIconModulate.opacity}
          renderOrder={renderOrder}
          canvasKey={renderOrder}
        />
      )}
      {content.labelBox && layout && (
        <ButtonLabel
          layout={layout}
          overrunBehavior={props.overrunBehavior}
          bidi={bidi}
          isWrapped={isButtonAutowrapped(props)}
          box={content.labelBox}
          fontSizePx={fontSizePx}
          tint={tintedFontColor}
          outline={textOutline}
          clippingPlanes={clippingPlanes}
          renderOrder={renderOrder}
        />
      )}
      <PositionedIcon
        rect={{
          x: content.checkPosition.x,
          y: content.checkPosition.y,
          w: drawnToggleSize.x,
          h: drawnToggleSize.y,
        }}
        texture={toggleTexture}
        color={toggleModulate.color}
        opacity={toggleModulate.opacity}
        renderOrder={renderOrder}
        canvasKey={renderOrder}
      />
    </>
  );
}
