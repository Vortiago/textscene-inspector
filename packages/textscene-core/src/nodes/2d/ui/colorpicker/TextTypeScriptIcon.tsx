/**
 * The `color_script` icon of the picker's `text_type` button.
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */
import type { NativeControlComponentProps } from '../../../../r3f/controls/ControlComponentRegistry';
import { useItemLinearColorOf } from '../../../../r3f/canvasItemModulate';
import { PositionedIcon } from '../../../../r3f/controls/native/PositionedIcon';
import { iconOnlyButtonIconRectIn } from '../../../../r3f/controls/native/buttonBase';
import { useNodeIcon } from '../../../../r3f/controls/native/useIconTexture';
import { COLOR_SCRIPT_ICON } from '../../../../r3f/controls/native/themeIcons';
import { colorPickerButtonIconSize } from './nativeSolver';
import type { PickerTheme } from './pickerChildTheme';
import { buttonIconColor } from '../button/nativeSolver';
import type { Rect2 } from '../../../../godot/math/rect2';
import { iconModulate } from '../../../../r3f/controls/native/IconButton';

interface TextTypeScriptIconProps {
  rect: Rect2;
  solveNode: NativeControlComponentProps['solveNode'];
  theme: PickerTheme;
  buttonColors: NativeControlComponentProps['solveNode']['colors'];
  tint: NativeControlComponentProps['tint'];
  renderOrder: number;
}

/**
 * The `color_script` icon of `text_type`, which `_update_text_value` disables while the colour is
 * not a valid hex (`color_picker.cpp:1319-1325`). The `Button` places it at its disabled box's left
 * margin (`button.cpp:349-405`) and modulates it by `icon_disabled_color`. Only a picker that draws
 * it loads the texture.
 */
export function TextTypeScriptIcon({
  rect,
  solveNode,
  theme,
  buttonColors,
  tint,
  renderOrder,
}: TextTypeScriptIconProps) {
  const toItemLinear = useItemLinearColorOf();
  const texture = useNodeIcon(solveNode.icons.color_script, COLOR_SCRIPT_ICON);
  if (!texture) return null;
  const iconPx = colorPickerButtonIconSize(theme);
  const iconRect = iconOnlyButtonIconRectIn(
    rect,
    theme.button.disabled.contentMargin,
    { x: iconPx, y: iconPx },
    solveNode.rtl
  );
  if (!iconRect) return null;
  const { color, opacity } = iconModulate(toItemLinear, tint, buttonIconColor(buttonColors, 'disabled'));
  return (
    <PositionedIcon
      rect={iconRect}
      texture={texture}
      color={color}
      opacity={opacity}
      renderOrder={renderOrder}
    />
  );
}
