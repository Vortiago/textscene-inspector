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
import type { OptionButtonProperties } from './types';

const DROPDOWN_DEFAULTS: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  padding: '6px 14px',
  borderRadius: '4px',
  backgroundColor: 'rgba(70, 78, 94, 0.95)',
  color: '#e8e8ea',
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
