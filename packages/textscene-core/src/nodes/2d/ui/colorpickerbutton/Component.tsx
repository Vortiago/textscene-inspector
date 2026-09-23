/**
 * The native (WebGL canvas) painter for ColorPickerButton. `NOTIFICATION_DRAW`
 * runs from base to derived: `<Button>` paints the chrome, then the checkerboard
 * and the colour swatch go over it (`color_picker.cpp:2426-2434`). The `PopupPanel`
 * is a `Window` and never draws here.
 */
import { useMemo } from 'react';
import { CanvasItemGroup } from '../../../../r3f/components/CanvasItemGroup';
import type { NativeControlComponentProps } from '../../../../r3f/controls/ControlComponentRegistry';
import { painterView } from '../../../../r3f/controls/native/solveTree';
import { ControlQuad } from '../../../../r3f/controls/native/controlQuad';
import { useIconTexture } from '../../../../r3f/controls/native/useIconTexture';
import { pickButtonStyleBox } from '../../../../r3f/controls/native/buttonBase';
import { multiplyModulate } from '../../../../r3f/canvasItemModulate';
import { useGodotLinearColor } from '../../../../r3f/godotColor';
import { parseColor } from '../../../../utils/colorParser';
import { Button } from '../button/Component';
import { AlphaCheckerboardQuad } from '../shared/AlphaCheckerboardQuad';
import { COLOR_PICKER_OVERBRIGHT_ICON } from '../../../../r3f/controls/native/themeIcons';
import { isColorOverbright } from '../shared/colorOverbright';
import type { ColorPickerButtonProperties } from './types';

export function ColorPickerButton(props: NativeControlComponentProps) {
  const { solveNode, tint, rect, renderOrder, theme } = props;
  const buttonProps = painterView<ColorPickerButtonProperties>(solveNode);

  const fill = useMemo(() => parseColor(buttonProps.color), [buttonProps.color]);
  const filled = useMemo(() => multiplyModulate(tint.own, fill), [tint.own, fill]);
  const swatchColor = useGodotLinearColor(filled);

  // `Rect2(normal_style->get_offset(), get_size() - normal_style->get_minimum_size())`: the
  // margins of "normal" in every draw state. `normal_style` binds Button's "normal" (`default_theme.cpp:1134`).
  const normalStyle = pickButtonStyleBox(solveNode.styleBoxes, theme.widgets.button, 'normal');
  const swatch = {
    x: normalStyle.contentMargin.left,
    y: normalStyle.contentMargin.top,
    w: rect.w - normalStyle.contentMargin.left - normalStyle.contentMargin.right,
    h: rect.h - normalStyle.contentMargin.top - normalStyle.contentMargin.bottom,
  };

  // `BIND_THEME_ITEM_EXT` looks `overbright_indicator` up under "ColorPicker" (`color_picker.cpp:2546`),
  // so even a local override on this node is skipped. `SolveNode.icons` walks the node's own
  // type chain, so the vendored icon stands in.
  const overbrightTexture = useIconTexture(COLOR_PICKER_OVERBRIGHT_ICON);
  const overbright = isColorOverbright(fill);

  // The checkerboard has no alpha gate (`color_picker.cpp:2428`), unlike the `preset_color.a < 1`
  // check of `ColorPresetButton`: an opaque swatch covers it.
  return (
    <>
      <Button {...props} />
      {swatch.w > 0 && swatch.h > 0 && (
        <CanvasItemGroup position={[swatch.x, -swatch.y, 0]}>
          <AlphaCheckerboardQuad
            width={swatch.w}
            height={swatch.h}
            color={tint.color}
            opacity={tint.opacity}
            renderOrder={renderOrder}
            themed={solveNode.icons.bg}
          />
          <ControlQuad width={swatch.w} height={swatch.h} color={swatchColor} opacity={filled.a} renderOrder={renderOrder} />
        </CanvasItemGroup>
      )}
      {overbright && (
        <CanvasItemGroup position={[normalStyle.contentMargin.left, -normalStyle.contentMargin.top, 0]}>
          <ControlQuad
            width={16}
            height={16}
            color={tint.color}
            opacity={tint.opacity}
            map={overbrightTexture}
            renderOrder={renderOrder}
          />
        </CanvasItemGroup>
      )}
    </>
  );
}
