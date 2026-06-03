/**
 * <Label> — a positioned <div> holding the node's text. Font size/color come
 * from `theme_override_font_sizes/font_size` + `theme_override_colors/font_color`;
 * a system font stack is used (the VS Code webview CSP blocks web fonts).
 */

import type { CSSProperties } from 'react';
import type { ControlComponentProps } from '../../../../r3f/controls/ControlComponentRegistry';
import { useControlParent } from '../../../../r3f/controls/ControlParentContext';
import { controlLayoutStyle } from '../../../../r3f/controls/controlLayout';
import { textThemeStyle } from '../../../../r3f/controls/textThemeStyle';
import type { LabelProperties } from './types';

const H_ALIGN = ['left', 'center', 'right', 'justify'] as const;
// Godot VerticalAlignment 0 TOP / 1 CENTER / 2 BOTTOM / 3 FILL → flex main-axis.
const V_JUSTIFY = ['flex-start', 'center', 'flex-end', 'stretch'] as const;

export function Label({ node }: ControlComponentProps) {
  const props = node.properties as LabelProperties;
  const parentKind = useControlParent();
  const style: CSSProperties = {
    ...controlLayoutStyle(props, parentKind),
    ...textThemeStyle(props, { sizeKey: 'font_size', colorKey: 'font_color' }),
  };

  if (props.horizontalAlignment !== undefined) {
    style.textAlign = H_ALIGN[props.horizontalAlignment] ?? 'left';
  }
  // Honor embedded newlines (Godot treats `\n` as a hard break regardless of
  // autowrap); autowrap additionally soft-wraps long lines.
  style.whiteSpace = props.autowrapMode ? 'pre-line' : 'pre';
  // Vertical alignment only bites when the label is taller than its text (a
  // stretched/min-sized label); apply it via a flex column.
  if (props.verticalAlignment !== undefined) {
    style.display = 'flex';
    style.flexDirection = 'column';
    style.justifyContent = V_JUSTIFY[props.verticalAlignment] ?? 'flex-start';
  }

  return (
    <div data-control-type="Label" data-node-name={node.name} style={style}>
      {props.text ?? ''}
    </div>
  );
}
