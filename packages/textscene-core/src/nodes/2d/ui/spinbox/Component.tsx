/**
 * `<SpinBox>`: the native painter for `SpinBox::_notification(NOTIFICATION_DRAW)`
 * (`scene/gui/spin_box.cpp:429-500`) without hover, pressed or drag state: the field's LineEdit
 * chrome, the glyphs of the text that end inside `ofs_max` and the stepper arrows. `ControlCanvasWalker` owns `visible`,
 * children and the transform.
 */
import { useMemo } from 'react';
import { CanvasItemGroup } from '../../../../r3f/components/CanvasItemGroup';
import type { NativeControlComponentProps } from '../../../../r3f/controls/ControlComponentRegistry';
import { painterView, controlLayoutOrder } from '../../../../r3f/controls/native/solveTree';
import { StyleBoxQuad } from '../../../../r3f/controls/native/StyleBoxQuad';
import { useNodeIcon } from '../../../../r3f/controls/native/useIconTexture';
import { useControlClipPlanes } from '../../../../r3f/controls/native/controlClipping';
import { tintColor } from '../../../../r3f/controls/native/buttonBase';
import { TextRun } from '../../../../r3f/controls/native/text/TextRun';
import type { TextLayoutResult } from '../../../../r3f/controls/native/text/textLayout';
import { PositionedIcon } from '../../../../r3f/controls/native/PositionedIcon';
import {
  pickLineEditStyleBox,
  resolveLineEditStyleState,
  layoutLineEditContent,
  lineEditDrawnLayout,
} from '../lineedit/nativeSolver';
import { resolveRangeValue } from '../shared/range';
import { SPIN_BOX_ICONS } from './icons';
import {
  spinBoxArrowPosition,
  spinBoxLayout,
  spinBoxDisplayText,
  shapeSpinBoxFieldText,
  spinBoxFieldTextTheme,
  spinBoxFieldThemeItems,
  spinBoxUpButtonState,
  spinBoxDownButtonState,
  spinBoxIconColor,
  spinBoxIconSize,
  spinBoxWidestButtonIconWidth,
} from './nativeSolver';
import type { SpinBoxProperties } from './types';
import { HorizontalAlignment } from '../../../../godot/math/alignment';
import { useItemLinearColor } from '../../../../r3f/canvasItemModulate';

export function SpinBox({
  solveNode,
  tint,
  childTint,
  rect,
  renderOrder,
  theme,
}: NativeControlComponentProps) {
  const props = painterView<SpinBoxProperties>(solveNode);
  const editable = props.editable !== false;

  const widestIconWidth = spinBoxWidestButtonIconWidth(solveNode, theme.scale);
  const layout = useMemo(
    () => spinBoxLayout({ x: rect.w, y: rect.h }, widestIconWidth, solveNode.rtl),
    [rect.w, rect.h, widestIconWidth, solveNode.rtl]
  );

  const styleState = resolveLineEditStyleState(props.editable);
  const fieldBox = pickLineEditStyleBox(
    spinBoxFieldThemeItems(solveNode).styleBoxes,
    theme.widgets.lineEdit,
    styleState
  );

  const orderedKeys = controlLayoutOrder(solveNode);
  const resolvedValue = resolveRangeValue(props, orderedKeys);
  const text = spinBoxDisplayText(props, resolvedValue, solveNode.locale);

  const { fontSizePx, fontMetrics, color: baseFontColor } = spinBoxFieldTextTheme(solveNode, editable);
  // `tint.own` is raw sRGB, `self_modulate` folded onto `modulate`: it feeds the arrows and their boxes.
  // The field is the internal LineEdit (`spin_box.cpp:431`, `line_edit.cpp:726`), so its box and its
  // text take `childTint`, which has no `self_modulate`. Each multiplies in before one sRGB-to-linear conversion.
  const tintedFontColor = useMemo(
    () => tintColor(baseFontColor, childTint.own),
    [baseFontColor, childTint.own]
  );

  const textLayout: TextLayoutResult = useMemo(
    () => shapeSpinBoxFieldText(text, { fontSizePx, fontMetrics }, solveNode.locale),
    [text, fontSizePx, fontMetrics, solveNode.locale]
  );

  const content = useMemo(
    () =>
      layoutLineEditContent({
        rectSize: { x: layout.fieldRect.w, y: layout.fieldRect.h },
        styleMargin: fieldBox.contentMargin,
        alignment: props.alignment ?? HorizontalAlignment.HORIZONTAL_ALIGNMENT_LEFT,
        textWidthPx: textLayout.widthPx,
        textHeightPx: textLayout.heightPx,
        rtl: solveNode.rtl,
      }),
    [
      layout.fieldRect.w,
      layout.fieldRect.h,
      fieldBox.contentMargin,
      props.alignment,
      textLayout,
      solveNode.rtl,
    ]
  );

  // The field's LineEdit draws no clip: it drops each glyph that ends past `ofs_max` (`line_edit.cpp:1512-1545`).
  const clippingPlanes = useControlClipPlanes();
  const drawnLayout: TextLayoutResult = useMemo(
    () => lineEditDrawnLayout(textLayout, content.textOffset.x, content.ofsMaxPx),
    [textLayout, content.textOffset.x, content.ofsMaxPx]
  );

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

  // SpinBox's own `theme_override_styles/*` items, empty in the default theme, so each draws only
  // under an override. `up_down_buttons_separator` has zero height (`SpinBoxLayout`) and never draws.
  const upBox = solveNode.styleBoxes[upState === 'disabled' ? 'up_background_disabled' : 'up_background'];
  const downBox =
    solveNode.styleBoxes[downState === 'disabled' ? 'down_background_disabled' : 'down_background'];
  const fieldSeparatorBox = solveNode.styleBoxes['field_and_buttons_separator'];

  return (
    <CanvasItemGroup>
      <CanvasItemGroup position={[layout.fieldRect.x, -layout.fieldRect.y, 0]}>
        <StyleBoxQuad
          styleBox={fieldBox}
          color={childTint.own}
          rect={{ x: 0, y: 0, w: layout.fieldRect.w, h: layout.fieldRect.h }}
          renderOrder={renderOrder}
        />
        {textLayout.lines.length > 0 && text.length > 0 && (
          <CanvasItemGroup position={[content.textOffset.x, -content.textOffset.y, 0]}>
            <TextRun
              layout={drawnLayout}
              fontSizePx={fontSizePx}
              tint={tintedFontColor}
              clippingPlanes={clippingPlanes}
              renderOrder={renderOrder}
            />
          </CanvasItemGroup>
        )}
      </CanvasItemGroup>
      {fieldSeparatorBox && (
        <CanvasItemGroup
          position={[layout.fieldAndButtonsSeparatorRect.x, -layout.fieldAndButtonsSeparatorRect.y, 0]}
        >
          <StyleBoxQuad
            styleBox={fieldSeparatorBox}
            color={tint.own}
            rect={{
              x: 0,
              y: 0,
              w: layout.fieldAndButtonsSeparatorRect.w,
              h: layout.fieldAndButtonsSeparatorRect.h,
            }}
            renderOrder={renderOrder}
          />
        </CanvasItemGroup>
      )}
      {upBox && (
        <CanvasItemGroup position={[layout.upRect.x, -layout.upRect.y, 0]}>
          <StyleBoxQuad
            styleBox={upBox}
            color={tint.own}
            rect={{ x: 0, y: 0, w: layout.upRect.w, h: layout.upRect.h }}
            renderOrder={renderOrder}
          />
        </CanvasItemGroup>
      )}
      {downBox && (
        <CanvasItemGroup position={[layout.downRect.x, -layout.downRect.y, 0]}>
          <StyleBoxQuad
            styleBox={downBox}
            color={tint.own}
            rect={{ x: 0, y: 0, w: layout.downRect.w, h: layout.downRect.h }}
            renderOrder={renderOrder}
          />
        </CanvasItemGroup>
      )}
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
