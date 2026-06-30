/**
 * <CheckBox> — renders the label text in a controlled `<div>` inside the 2D-UI
 * overlay. Font size/color come from `theme_override_font_sizes/font_size` +
 * `theme_override_colors/font_color`; a system font stack is used (the VS Code
 * webview CSP blocks web fonts). The `buttonPressed` state is exposed on
 * `data-checked` for contract tests.
 */

import type { CSSProperties } from 'react';
import type { ControlComponentProps } from '../../../../r3f/controls/ControlComponentRegistry';
import { useControlParent } from '../../../../r3f/controls/ControlParentContext';
import { controlLayoutStyle } from '../../../../r3f/controls/controlLayout';
import { textThemeStyle } from '../../../../r3f/controls/textThemeStyle';
import type { CheckBoxProperties } from './types';

export function CheckBox({ node }: ControlComponentProps) {
  const props = node.properties as CheckBoxProperties;
  const parentKind = useControlParent();
  const style: CSSProperties = {
    ...controlLayoutStyle(props, parentKind),
    ...textThemeStyle(props, { sizeKey: 'font_size', colorKey: 'font_color' }),
  };

  if (props.disabled) style.opacity = 0.6;

  return (
    <div data-control-type="CheckBox" data-checked={props.buttonPressed ? "true" : "false"} style={style}>
      {props.text ?? ''}
    </div>
  );
}
