/**
 * `<CheckButton>`, the native (WebGL canvas) painter: what Button draws, then a toggle-switch icon over
 * it, always drawn, on the side opposite CheckBox's check. The default boxes are one `StyleBoxEmpty`, so
 * no chrome shows until a theme gives one.
 */
import { useMemo } from 'react';
import type { NativeControlComponentProps } from '../../../../r3f/controls/ControlComponentRegistry';
import { painterView } from '../../../../r3f/controls/native/solveTree';
import { ButtonOverlayIcon, ButtonPainter } from '../button/Component';
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
  const toggleRect = useMemo(
    () => checkButtonToggleRect(solveNode, theme, iconKey, { x: rect.w, y: rect.h }),
    [solveNode, theme, iconKey, rect.w, rect.h]
  );
  return (
    <ButtonOverlayIcon
      rect={toggleRect}
      texture={useCheckButtonIcon(solveNode, iconKey)}
      color={checkButtonIconColor(props, solveNode.colors)}
      tint={tint.own}
      renderOrder={renderOrder}
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
