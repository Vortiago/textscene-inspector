/**
 * <OptionButton> — renders the SELECTED item's text inside a collapsed dropdown
 * affordance (<div>) on the 2D-UI overlay. Font size/color come from
 * `theme_override_font_sizes/font_size` + `theme_override_colors/font_color`;
 * a system font stack is used (the VS Code webview CSP blocks web fonts). Only
 * the selected item is shown — not all items, not the first item.
 */

import type { CSSProperties } from 'react';
import type { ControlComponentProps } from '../../../../r3f/controls/ControlComponentRegistry';
import { useControlParent } from '../../../../r3f/controls/ControlParentContext';
import { controlStyle } from '../../../../r3f/controls/controlLayout';
import { textThemeStyle } from '../../../../r3f/controls/textThemeStyle';
import {
  DEFAULT_FONT_COLOR,
  STYLE_NORMAL_FILL,
  type ScaledGodotTheme,
} from '../../../../r3f/controls/godotDefaultTheme';
import { useGodotTheme } from '../../../../r3f/controls/useGodotTheme';
import type { OptionButtonProperties } from './types';

/**
 * Godot's OptionButton wears the button "normal" StyleBoxFlat (dark,
 * translucent) with 8/4 content margins at scale 1 — sourced from the default
 * theme so it blends over the overlay backdrop the way the engine does, and
 * scaled with it so a project's `gui/theme/default_theme_scale` carries.
 */
function dropdownDefaults(theme: ScaledGodotTheme): CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    padding: `${theme.optionButtonMarginY}px ${theme.optionButtonMarginX}px`,
    borderRadius: `${theme.cornerRadius}px`,
    backgroundColor: STYLE_NORMAL_FILL,
    fontSize: `${theme.fontSize}px`,
    color: DEFAULT_FONT_COLOR,
  };
}

export function OptionButton({ node, children }: ControlComponentProps) {
  const props = node.properties as OptionButtonProperties;
  const parentKind = useControlParent();
  const theme = useGodotTheme();
  const style: CSSProperties = controlStyle(
    props,
    parentKind,
    dropdownDefaults(theme),
    { textAlign: 'left', cursor: props.disabled ? 'default' : 'pointer' },
    textThemeStyle(props, { sizeKey: 'font_size', colorKey: 'font_color' })
  );

  if (props.disabled) style.opacity = 0.6;

  // Resolve the selected item by its Godot index, bounds-guarded — an out-of-range or
  // absent `selected` falls back to empty text (a decision, not an accident).
  const items = props.items ?? [];
  const selectedIndex = props.selected ?? -1;
  const selectedItem = selectedIndex >= 0 && selectedIndex < items.length ? items[selectedIndex] : undefined;

  return (
    <div data-control-type="OptionButton" data-node-name={node.name} style={style}>
      {selectedItem?.text ?? ''}
      {children}
    </div>
  );
}
