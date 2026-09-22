/**
 * `<ColorPickerButton>` — the native (WebGL canvas) painter for
 * ColorPickerButton. Godot's own `_notification` chain runs BOTH levels for
 * `NOTIFICATION_DRAW` (`GDCLASS`'s `_notification_forwardv` walks base to
 * derived): `Button::_notification` paints the button's chrome first, then
 * `ColorPickerButton::_notification` (`color_picker.cpp:2426-2434`) paints
 * the checkerboard + colour swatch OVER it. This component reuses `<Button>`
 * for the first pass and adds its own swatch after — the SAME structure, not
 * a re-derivation of Button's chrome.
 *
 * The swatch rect is `Rect2(theme_cache.normal_style->get_offset(), get_size()
 * - theme_cache.normal_style->get_minimum_size())` — the "normal" StyleBox's
 * own content margins, regardless of the button's CURRENT draw state
 * (disabled or not). `theme_cache.normal_style` is bound to the same
 * StyleBoxFlat as Button's own "normal" (`default_theme.cpp:1134`), so
 * `theme.widgets.button` already has it.
 *
 * The checkerboard is drawn UNCONDITIONALLY (`color_picker.cpp:2428` has no
 * alpha gate, unlike `ColorPresetButton::_notification`'s `preset_color.a < 1`
 * check) — an opaque swatch simply covers it.
 *
 * Its `PopupPanel` is a `Window` and never draws here.
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

  const normalStyle = pickButtonStyleBox(solveNode.styleBoxes, theme.widgets.button, 'normal');
  const swatch = {
    x: normalStyle.contentMargin.left,
    y: normalStyle.contentMargin.top,
    w: rect.w - normalStyle.contentMargin.left - normalStyle.contentMargin.right,
    h: rect.h - normalStyle.contentMargin.top - normalStyle.contentMargin.bottom,
  };

  // `overbright_indicator` is `BIND_THEME_ITEM_EXT(Theme::DATA_TYPE_ICON,
  // ColorPickerButton, overbright_indicator, "overbright_indicator",
  // "ColorPicker")` (`color_picker.cpp:2546`) — a FOREIGN type lookup:
  // Godot resolves it under "ColorPicker", never this node's own
  // "ColorPickerButton" (and `get_theme_icon`'s local-override guard, which
  // tests `p_theme_type == get_class_name()`, therefore skips even a local
  // `theme_override_icons/overbright_indicator` authored on this very node).
  // `SolveNode.icons` is resolved under the node's OWN type chain, so it
  // cannot answer this without a second, foreign-scoped theme walk — left
  // vendored-only, not modelled by the theme-icon mechanism this pass adds.
  const overbrightTexture = useIconTexture(COLOR_PICKER_OVERBRIGHT_ICON);
  const overbright = isColorOverbright(fill);

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
