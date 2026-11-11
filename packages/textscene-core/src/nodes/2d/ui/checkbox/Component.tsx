/**
 * `<CheckBox>`, the native (WebGL canvas) painter: what Button draws, then the check or radio icon over
 * it, always iconModulate (`check_box.cpp::_notification` has no visibility gate). The default boxes are one
 * `StyleBoxEmpty`, so no chrome shows until a theme gives one.
 */
import { useMemo } from 'react';
import type { NativeControlComponentProps } from '../../../../r3f/controls/ControlComponentRegistry';
import { painterView } from '../../../../r3f/controls/native/solveTree';
import { PositionedIcon } from '../../../../r3f/controls/native/PositionedIcon';
import { useIconModulate } from '../../../../r3f/controls/native/useButtonIcon';
import { ButtonPainter, buttonOverlayRenderOrder } from '../button/Component';
import { useCheckBoxIcon } from './useCheckBoxIcon';
import {
  CHECK_BOX_CLASS,
  checkBoxCheckColor,
  checkBoxCheckRect,
  resolveCheckBoxIconKey,
} from './nativeSolver';
import type { CheckBoxProperties } from './types';

/** The icon `CheckBox::_notification` draws after Button's own draw (`check_box.cpp:107-142`). */
function CheckBoxCheck({ solveNode, tint, rect, renderOrder, theme }: NativeControlComponentProps) {
  const props = painterView<CheckBoxProperties>(solveNode);
  const iconKey = resolveCheckBoxIconKey(props);
  const texture = useCheckBoxIcon(solveNode, iconKey);
  const iconModulate = useIconModulate(checkBoxCheckColor(props, solveNode.colors), tint.own);
  const checkRect = useMemo(
    () => checkBoxCheckRect(solveNode, theme, iconKey, { x: rect.w, y: rect.h }),
    [solveNode, theme, iconKey, rect.w, rect.h]
  );
  return (
    <PositionedIcon
      rect={checkRect}
      texture={texture}
      color={iconModulate.color}
      opacity={iconModulate.opacity}
      renderOrder={buttonOverlayRenderOrder(renderOrder)}
    />
  );
}

export function CheckBox(props: NativeControlComponentProps) {
  return (
    <>
      <ButtonPainter {...props} buttonClass={CHECK_BOX_CLASS} />
      <CheckBoxCheck {...props} />
    </>
  );
}
