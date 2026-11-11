/**
 * `<CheckButton>`, the native (WebGL canvas) painter: what Button draws, then a toggle-switch icon over
 * it, always iconModulate, on the side opposite CheckBox's check. The default boxes are one `StyleBoxEmpty`, so no
 * chrome shows until a theme gives one.
 */
import { useMemo } from 'react';
import type { NativeControlComponentProps } from '../../../../r3f/controls/ControlComponentRegistry';
import { painterView } from '../../../../r3f/controls/native/solveTree';
import { PositionedIcon } from '../../../../r3f/controls/native/PositionedIcon';
import { useIconModulate } from '../../../../r3f/controls/native/useButtonIcon';
import { ButtonPainter, buttonOverlayRenderOrder } from '../button/Component';
import { useCheckButtonIcon } from './useCheckButtonIcon';
import {
  CHECK_BUTTON_CLASS,
  checkButtonIconColor,
  checkButtonToggleRect,
  resolveCheckButtonIconKey,
} from './nativeSolver';
import type { CheckButtonProperties } from './types';

/** The icon `CheckButton::_notification` draws after Button's own draw (`check_button.cpp:106-146`). */
function CheckButtonToggle({ solveNode, tint, rect, renderOrder, theme }: NativeControlComponentProps) {
  const props = painterView<CheckButtonProperties>(solveNode);
  const iconKey = resolveCheckButtonIconKey(props, solveNode.rtl);
  const texture = useCheckButtonIcon(solveNode, iconKey);
  // The toggle colour is a theme key a scene can override, so it takes the tint before its one
  // sRGB-to-linear conversion, as Button's icon does.
  const iconModulate = useIconModulate(checkButtonIconColor(props, solveNode.colors), tint.own);
  const toggleRect = useMemo(
    () => checkButtonToggleRect(solveNode, theme, iconKey, { x: rect.w, y: rect.h }),
    [solveNode, theme, iconKey, rect.w, rect.h]
  );
  return (
    <PositionedIcon
      rect={toggleRect}
      texture={texture}
      color={iconModulate.color}
      opacity={iconModulate.opacity}
      renderOrder={buttonOverlayRenderOrder(renderOrder)}
      canvasKey={renderOrder}
    />
  );
}

export function CheckButton(props: NativeControlComponentProps) {
  return (
    <>
      <ButtonPainter {...props} buttonClass={CHECK_BUTTON_CLASS} />
      <CheckButtonToggle {...props} />
    </>
  );
}
