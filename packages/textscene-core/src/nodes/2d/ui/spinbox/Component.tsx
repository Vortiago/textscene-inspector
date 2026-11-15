/**
 * `<SpinBox>`: the native painter for `SpinBox::_notification(NOTIFICATION_DRAW)`
 * (`scene/gui/spin_box.cpp:429-500`) without hover, pressed or drag state: the stepper arrows and
 * their boxes. The internal LineEdit draws the field (`nativeSolver.ts`). `ControlCanvasWalker` owns
 * `visible`, children and the transform.
 */
import { useMemo } from 'react';
import { CanvasItemGroup } from '../../../../r3f/components/CanvasItemGroup';
import type { NativeControlComponentProps } from '../../../../r3f/controls/ControlComponentRegistry';
import { painterView, controlLayoutOrder } from '../../../../r3f/controls/native/solveTree';
import { useNodeIcon } from '../../../../r3f/controls/native/useIconTexture';
import { tintColor } from '../../../../r3f/controls/native/buttonBase';
import { PositionedIcon } from '../../../../r3f/controls/native/PositionedIcon';
import { PositionedStyleBox } from '../../../../r3f/controls/native/PositionedStyleBox';
import { resolveRangeValue } from '../shared/range';
import { SPIN_BOX_ICONS } from './icons';
import {
  spinBoxArrowPosition,
  spinBoxLayout,
  spinBoxUpButtonState,
  spinBoxDownButtonState,
  spinBoxIconColor,
  spinBoxIconSize,
  spinBoxWidestButtonIconWidth,
} from './nativeSolver';
import type { SpinBoxProperties } from './types';
import { useItemLinearColor } from '../../../../r3f/canvasItemModulate';
import { requiredThemeItem } from '../../../../r3f/controls/native/themeItems';

export function SpinBox({ solveNode, tint, rect, renderOrder, theme }: NativeControlComponentProps) {
  const props = painterView<SpinBoxProperties>(solveNode);

  const widestIconWidth = spinBoxWidestButtonIconWidth(solveNode, theme.scale);
  const layout = useMemo(
    () => spinBoxLayout({ x: rect.w, y: rect.h }, widestIconWidth, solveNode.rtl),
    [rect.w, rect.h, widestIconWidth, solveNode.rtl]
  );

  const resolvedValue = resolveRangeValue(props, controlLayoutOrder(solveNode));

  const upState = spinBoxUpButtonState(props, resolvedValue);
  const downState = spinBoxDownButtonState(props, resolvedValue);
  const upIconTexture = useNodeIcon(solveNode.icons.up, SPIN_BOX_ICONS.up);
  const downIconTexture = useNodeIcon(solveNode.icons.down, SPIN_BOX_ICONS.down);
  const upIconSize = spinBoxIconSize(solveNode, 'up', theme.scale);
  const downIconSize = spinBoxIconSize(solveNode, 'down', theme.scale);

  const upIconColorSrgb = useMemo(
    () => tintColor(spinBoxIconColor(solveNode.colors, 'up', upState), tint.own),
    [solveNode.colors, upState, tint.own]
  );
  const downIconColorSrgb = useMemo(
    () => tintColor(spinBoxIconColor(solveNode.colors, 'down', downState), tint.own),
    [solveNode.colors, downState, tint.own]
  );
  const upIconLinear = useItemLinearColor(upIconColorSrgb);
  const downIconLinear = useItemLinearColor(downIconColorSrgb);

  const upIconPos = spinBoxArrowPosition(layout.upRect, upIconSize);
  const downIconPos = spinBoxArrowPosition(layout.downRect, downIconSize);

  // StyleBoxEmpty in the table's `SpinBox` styles, so each draws only under an
  // override. `up_down_buttons_separator` has zero height (`SpinBoxLayout`) and never draws.
  const upBox = requiredThemeItem(
    solveNode.styleBoxes,
    upState === 'disabled' ? 'up_background_disabled' : 'up_background'
  );
  const downBox = requiredThemeItem(
    solveNode.styleBoxes,
    downState === 'disabled' ? 'down_background_disabled' : 'down_background'
  );
  const fieldSeparatorBox = requiredThemeItem(solveNode.styleBoxes, 'field_and_buttons_separator');

  return (
    <CanvasItemGroup>
      <PositionedStyleBox
        box={fieldSeparatorBox}
        rect={layout.fieldAndButtonsSeparatorRect}
        tint={tint}
        renderOrder={renderOrder}
      />
      <PositionedStyleBox box={upBox} rect={layout.upRect} tint={tint} renderOrder={renderOrder} />
      <PositionedStyleBox box={downBox} rect={layout.downRect} tint={tint} renderOrder={renderOrder} />
      <PositionedIcon
        rect={{ x: upIconPos.x, y: upIconPos.y, w: upIconSize.x, h: upIconSize.y }}
        texture={upIconTexture}
        color={upIconLinear}
        opacity={upIconColorSrgb.a}
        renderOrder={renderOrder}
        canvasKey={renderOrder}
      />
      <PositionedIcon
        rect={{ x: downIconPos.x, y: downIconPos.y, w: downIconSize.x, h: downIconSize.y }}
        texture={downIconTexture}
        color={downIconLinear}
        opacity={downIconColorSrgb.a}
        renderOrder={renderOrder}
        canvasKey={renderOrder}
      />
    </CanvasItemGroup>
  );
}
