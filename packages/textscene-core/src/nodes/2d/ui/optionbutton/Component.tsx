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
  DEFAULT_CORNER_RADIUS,
  DEFAULT_FONT_COLOR,
  DEFAULT_FONT_SIZE,
  OPTION_BUTTON_CONTENT_MARGIN_X,
  OPTION_BUTTON_CONTENT_MARGIN_Y,
  STYLE_NORMAL_FILL,
} from '../../../../r3f/controls/godotDefaultTheme';
import type { OptionButtonProperties } from './types';

// Godot's OptionButton wears the button "normal" StyleBoxFlat (dark, translucent)
// with 8/4 content margins — sourced from the default theme so it blends over
// the overlay backdrop the way the engine does.
const DROPDOWN_DEFAULTS: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  padding: `${OPTION_BUTTON_CONTENT_MARGIN_Y}px ${OPTION_BUTTON_CONTENT_MARGIN_X}px`,
  borderRadius: `${DEFAULT_CORNER_RADIUS}px`,
  backgroundColor: STYLE_NORMAL_FILL,
  fontSize: `${DEFAULT_FONT_SIZE}px`,
  color: DEFAULT_FONT_COLOR,
};

export function OptionButton({ node, children }: ControlComponentProps) {
  const props = node.properties as OptionButtonProperties;
  const parentKind = useControlParent();
  const style: CSSProperties = controlStyle(
    props,
    parentKind,
    DROPDOWN_DEFAULTS,
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
