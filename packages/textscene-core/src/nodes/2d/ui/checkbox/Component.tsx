/**
 * `<CheckBox>`, the native (WebGL canvas) painter: Button's own icon, the label, and the check or radio
 * icon, always drawn (`check_box.cpp::_notification` has no visibility gate). It draws no chrome:
 * the "normal" StyleBox is a `StyleBoxEmpty`. `ControlCanvasWalker` owns `visible`, the
 * children and the transform.
 */
import { useMemo } from 'react';
import type { NativeControlComponentProps } from '../../../../r3f/controls/ControlComponentRegistry';
import { painterView } from '../../../../r3f/controls/native/solveTree';
import { useControlClipPlanes } from '../../../../r3f/controls/native/controlClipping';
import { useCheckBoxIcon } from './useCheckBoxIcon';
import { ButtonLabel, useWrappingButtonLabelLayout } from '../../../../r3f/controls/native/ButtonLabel';
import { useTintedTextOutline } from '../../../../r3f/controls/native/text/OutlinedTextRun';
import { infersRtl } from '../../../../r3f/controls/native/text/textLayout';
import {
  BUTTON_ICON_SLOT_KEY,
  isButtonAutowrapped,
  labelNaturalSize,
  tintColor,
} from '../../../../r3f/controls/native/buttonBase';
import { PositionedIcon } from '../../../../r3f/controls/native/PositionedIcon';
import { useIconModulate, useOwnButtonTexture } from '../../../../r3f/controls/native/useButtonIcon';
import { useControlBidiOptions } from '../../../../r3f/controls/native/text/useControlBidiOptions';
import { buttonIconColor } from '../button/nativeSolver';
import {
  checkBoxContentFacts,
  checkBoxDrawnIconSize,
  checkBoxFittedIconSize,
  checkBoxCheckVOffset,
  checkBoxTextTheme,
  layoutCheckBoxContent,
  resolveCheckBoxDrawState,
  resolveCheckBoxIconKey,
  CHECKBOX_THEME_FONT_KEY,
} from './nativeSolver';
import type { CheckBoxProperties } from './types';

export function CheckBox({ solveNode, tint, rect, renderOrder, theme }: NativeControlComponentProps) {
  const props = painterView<CheckBoxProperties>(solveNode);
  const state = resolveCheckBoxDrawState(props);

  // `renderOrder` reaches every mesh. `<TextRun>` builds its own material, so it takes
  // the clip planes explicitly, while the icon quads read them themselves.
  const clippingPlanes = useControlClipPlanes();

  const checkKey = resolveCheckBoxIconKey(props);
  const checkTexture = useCheckBoxIcon(solveNode, checkKey);
  // Fitted, not rounded: CheckBox draws `_fit_icon_size` as it is (`check_box.cpp:61`, `:140-142`).
  const checkSize = useMemo(() => checkBoxFittedIconSize(solveNode), [solveNode]);
  const drawnCheckSize = useMemo(() => checkBoxDrawnIconSize(solveNode, checkKey), [solveNode, checkKey]);

  const ownIconTexture = useOwnButtonTexture(solveNode, props.icon);
  const ownIconSize = solveNode.textureSlots[BUTTON_ICON_SLOT_KEY] ?? null;
  const ownIconModulate = useIconModulate(buttonIconColor(solveNode.colors, state), tint.own);

  const text = props.text ?? '';
  const { fontSizePx, color: baseFontColor } = checkBoxTextTheme(solveNode, props, state, { theme });
  const tintedFontColor = useMemo(() => tintColor(baseFontColor, tint.own), [baseFontColor, tint.own]);
  const textOutline = useTintedTextOutline(solveNode, tint.own);

  const bidi = useControlBidiOptions(props, solveNode);
  const facts = useMemo(
    () => checkBoxContentFacts(solveNode, props, { theme }, { x: rect.w, y: rect.h }, ownIconSize),
    [solveNode, props, theme, rect.w, rect.h, ownIconSize]
  );
  const layout = useWrappingButtonLabelLayout(
    solveNode,
    props,
    { themeFontKey: CHECKBOX_THEME_FONT_KEY, text, fontSizePx, bidi },
    facts
  );

  const content = useMemo(
    () =>
      layoutCheckBoxContent({
        // The height sums independently ceiled ascent and descent and an integral spacing.
        content: { ...facts, textNaturalSize: labelNaturalSize(layout), isTextRtl: infersRtl(layout) },
        checkSize,
        checkVOffset: checkBoxCheckVOffset(solveNode.constants),
      }),
    [facts, layout, checkSize, solveNode.constants]
  );

  const checkRect = useMemo(
    () => ({ ...content.checkPosition, w: drawnCheckSize.x, h: drawnCheckSize.y }),
    [content.checkPosition, drawnCheckSize.x, drawnCheckSize.y]
  );

  // Button draws its icon and label first (`button.cpp:333-456`), then CheckBox its check. The check's
  // colour is opaque white in both states (`default_theme.cpp:312-313`), and the disabled SVGs carry their
  // own dimming, so it takes the tint directly.
  return (
    <>
      {content.icon && (
        <PositionedIcon
          rect={content.icon.rect}
          texture={ownIconTexture}
          color={ownIconModulate.color}
          opacity={ownIconModulate.opacity}
          renderOrder={renderOrder}
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
        rect={checkRect}
        texture={checkTexture}
        color={tint.color}
        opacity={tint.opacity}
        renderOrder={renderOrder}
      />
    </>
  );
}
