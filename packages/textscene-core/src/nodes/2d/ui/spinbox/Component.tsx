/**
 * `<SpinBox>` — the native (WebGL canvas) painter for `SpinBox`: the internal
 * field's LineEdit-style chrome and ONE clipped run of text (`value` formatted
 * with `prefix`/`suffix` and `step`'s own decimal precision), plus the up/down
 * stepper arrows — `SpinBox::_notification(NOTIFICATION_DRAW)`
 * (`scene/gui/spin_box.cpp:429-500`), restricted to what a static preview can
 * ever reach: no hover/pressed/drag state, and both button backgrounds plus
 * the field/buttons separator are EMPTY in the default theme
 * (`nativeSolver.ts`'s own doc), so they draw only when this node's own
 * `theme_override_styles/*` provides one. `up_down_buttons_separator` is
 * never drawn: its own rect is permanently zero-height (`nativeSolver.ts`'s
 * `SpinBoxLayout` doc).
 *
 * Tint: the walker's `tint` prop — `self_modulate` already folded onto the
 * inherited `modulate`. `tint.own` (raw sRGB) feeds every `<StyleBoxQuad>`'s
 * `color` prop and is multiplied into the field's font colour and each arrow's
 * icon colour before their own single sRGB→linear conversion — `Button`'s
 * established ordering.
 *
 * This component never checks `props.visible`, never renders `children`, and
 * never applies a transform — all three are `ControlCanvasWalker`'s job.
 */
import { useMemo } from 'react';
import { CanvasItemGroup } from '../../../../r3f/components/CanvasItemGroup';
import type { NativeControlComponentProps } from '../../../../r3f/controls/ControlComponentRegistry';
import { painterView, controlLayoutOrder } from '../../../../r3f/controls/native/solveTree';
import { useGodotLinearColor } from '../../../../r3f/godotColor';
import { StyleBoxQuad } from '../../../../r3f/controls/native/StyleBoxQuad';
import { ControlQuad } from '../../../../r3f/controls/native/controlQuad';
import { useNodeIcon } from '../../../../r3f/controls/native/useIconTexture';
import { useWorldClipPlanes } from '../../../../r3f/controls/native/controlClipping';
import { tintColor } from '../../../../r3f/controls/native/buttonBase';
import { TextRun } from '../../../../r3f/controls/native/text/TextRun';
import { shapeText, AutowrapMode, type TextLayoutResult } from '../../../../r3f/controls/native/text/textLayout';
import {
  pickLineEditStyleBox,
  resolveLineEditStyleState,
  layoutLineEditContent,
} from '../lineedit/nativeSolver';
import { resolveRangeValue } from '../shared/range';
import { SPIN_BOX_ICONS } from './icons';
import {
  spinBoxLayout,
  spinBoxDisplayText,
  spinBoxFieldTextTheme,
  spinBoxUpButtonState,
  spinBoxDownButtonState,
  spinBoxIconColor,
  spinBoxIconSize,
  spinBoxWidestButtonIconWidth,
} from './nativeSolver';
import type { SpinBoxProperties } from './types';

const HORIZONTAL_ALIGNMENT_LEFT = 0;

export function SpinBox({ solveNode, tint, rect, renderOrder, theme }: NativeControlComponentProps) {
  const props = painterView<SpinBoxProperties>(solveNode);
  const editable = props.editable !== false;

  const widestIconWidth = spinBoxWidestButtonIconWidth(solveNode);
  const layout = useMemo(
    () => spinBoxLayout({ x: rect.w, y: rect.h }, widestIconWidth),
    [rect.w, rect.h, widestIconWidth]
  );

  // --- Field chrome + text ---------------------------------------------------
  const styleState = resolveLineEditStyleState(props.editable);
  const fieldBox = pickLineEditStyleBox({}, theme.widgets.lineEdit, styleState);

  const orderedKeys = controlLayoutOrder(solveNode);
  const resolvedValue = resolveRangeValue(props, orderedKeys);
  const text = spinBoxDisplayText(props, resolvedValue);

  const { fontSizePx, fontMetrics, color: baseFontColor } = spinBoxFieldTextTheme(solveNode, { theme }, editable);
  const tintedFontColor = useMemo(() => tintColor(baseFontColor, tint.own), [baseFontColor, tint.own]);

  const textLayout: TextLayoutResult = useMemo(
    () => shapeText(text, { fontSizePx, boxWidthPx: 0, autowrapMode: AutowrapMode.OFF, lineSpacingPx: 0, fontMetrics }),
    [text, fontSizePx, fontMetrics]
  );

  const content = useMemo(
    () =>
      layoutLineEditContent({
        rectSize: { x: layout.fieldRect.w, y: layout.fieldRect.h },
        styleMargin: fieldBox.contentMargin,
        alignment: props.alignment ?? HORIZONTAL_ALIGNMENT_LEFT,
        textWidthPx: textLayout.widthPx,
        textHeightPx: textLayout.heightPx,
      }),
    [layout.fieldRect.w, layout.fieldRect.h, fieldBox.contentMargin, props.alignment, textLayout]
  );

  const { anchorRef, clippingPlanes } = useWorldClipPlanes(content.contentRect);

  // --- Stepper arrows ---------------------------------------------------------
  const upState = spinBoxUpButtonState(props, resolvedValue);
  const downState = spinBoxDownButtonState(props, resolvedValue);
  const upIconTexture = useNodeIcon(solveNode.icons.up, SPIN_BOX_ICONS.up);
  const downIconTexture = useNodeIcon(solveNode.icons.down, SPIN_BOX_ICONS.down);
  const upIconSize = spinBoxIconSize(solveNode, 'up');
  const downIconSize = spinBoxIconSize(solveNode, 'down');

  const upIconColorSrgb = useMemo(
    () => tintColor(spinBoxIconColor(solveNode.colors, 'up', upState), tint.own),
    [solveNode.colors, upState, tint.own]
  );
  const downIconColorSrgb = useMemo(
    () => tintColor(spinBoxIconColor(solveNode.colors, 'down', downState), tint.own),
    [solveNode.colors, downState, tint.own]
  );
  const upIconLinear = useGodotLinearColor(upIconColorSrgb);
  const downIconLinear = useGodotLinearColor(downIconColorSrgb);

  // `Point2i up_icon_left/top` (`spin_box.cpp:475-476`) — centred within the
  // button's own rect, at the icon's native (unscaled, see `nativeSolver.ts`) size.
  const upIconPos = {
    x: layout.upRect.x + (layout.upRect.w - upIconSize.x) / 2,
    y: layout.upRect.y + (layout.upRect.h - upIconSize.y) / 2,
  };
  const downIconPos = {
    x: layout.downRect.x + (layout.downRect.w - downIconSize.x) / 2,
    y: layout.downRect.y + (layout.downRect.h - downIconSize.y) / 2,
  };

  // `theme_override_styles/*` authored on THIS node — SpinBox's own item
  // names, empty in the default theme (`nativeSolver.ts`'s own doc), so
  // there is nothing to draw absent an override.
  const upBox = solveNode.styleBoxes[upState === 'disabled' ? 'up_background_disabled' : 'up_background'];
  const downBox = solveNode.styleBoxes[downState === 'disabled' ? 'down_background_disabled' : 'down_background'];
  const fieldSeparatorBox = solveNode.styleBoxes['field_and_buttons_separator'];

  return (
    <CanvasItemGroup ref={anchorRef}>
      <StyleBoxQuad
        styleBox={fieldBox}
        color={tint.own}
        rect={{ x: 0, y: 0, w: layout.fieldRect.w, h: layout.fieldRect.h }}
        renderOrder={renderOrder}
      />
      {textLayout.lines.length > 0 && text.length > 0 && (
        <CanvasItemGroup position={[content.textOffset.x, -content.textOffset.y, 0]}>
          <TextRun
            layout={textLayout}
            fontSizePx={fontSizePx}
            tint={tintedFontColor}
            clippingPlanes={clippingPlanes}
            renderOrder={renderOrder}
          />
        </CanvasItemGroup>
      )}
      {fieldSeparatorBox && (
        <CanvasItemGroup position={[layout.fieldAndButtonsSeparatorRect.x, -layout.fieldAndButtonsSeparatorRect.y, 0]}>
          <StyleBoxQuad
            styleBox={fieldSeparatorBox}
            color={tint.own}
            rect={{ x: 0, y: 0, w: layout.fieldAndButtonsSeparatorRect.w, h: layout.fieldAndButtonsSeparatorRect.h }}
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
      <CanvasItemGroup position={[upIconPos.x, -upIconPos.y, 0]}>
        <ControlQuad
          renderOrder={renderOrder}
          width={upIconSize.x}
          height={upIconSize.y}
          color={upIconLinear}
          opacity={upIconColorSrgb.a}
          map={upIconTexture}
        />
      </CanvasItemGroup>
      <CanvasItemGroup position={[downIconPos.x, -downIconPos.y, 0]}>
        <ControlQuad
          renderOrder={renderOrder}
          width={downIconSize.x}
          height={downIconSize.y}
          color={downIconLinear}
          opacity={downIconColorSrgb.a}
          map={downIconTexture}
        />
      </CanvasItemGroup>
    </CanvasItemGroup>
  );
}
