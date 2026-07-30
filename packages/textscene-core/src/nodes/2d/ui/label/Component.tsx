/**
 * <Label> — a positioned <div> holding the node's text. Font size/color come
 * from `theme_override_font_sizes/font_size` + `theme_override_colors/font_color`;
 * a system font stack is used (the VS Code webview CSP blocks web fonts).
 *
 * Absent an override the size is the theme's `default_font_size` at the
 * project's `gui/theme/default_theme_scale`, set EXPLICITLY rather than left to
 * inherit: the overlay and the off-screen raster host both happen to sit at
 * 16px today, so inheriting matched Godot only by coincidence and could not
 * follow a scaled project at all.
 */

import type { CSSProperties } from 'react';
import type { ControlComponentProps } from '../../../../r3f/controls/ControlComponentRegistry';
import { useControlParent } from '../../../../r3f/controls/ControlParentContext';
import { controlLayoutStyle } from '../../../../r3f/controls/controlLayout';
import { textThemeStyle } from '../../../../r3f/controls/textThemeStyle';
import { useGodotTheme } from '../../../../r3f/controls/useGodotTheme';
import type { LabelProperties } from './types';

const H_ALIGN = ['left', 'center', 'right', 'justify'] as const;
// Godot VerticalAlignment 0 TOP / 1 CENTER / 2 BOTTOM / 3 FILL → flex main-axis.
const V_JUSTIFY = ['flex-start', 'center', 'flex-end', 'stretch'] as const;

export function Label({ node, children }: ControlComponentProps) {
  const props = node.properties as LabelProperties;
  const parentKind = useControlParent();
  const theme = useGodotTheme();
  const style: CSSProperties = {
    ...controlLayoutStyle(props, parentKind),
    fontSize: `${theme.fontSize}px`,
    // After the theme size, so `theme_override_font_sizes/font_size` still wins.
    ...textThemeStyle(props, { sizeKey: 'font_size', colorKey: 'font_color' }),
  };

  if (props.horizontalAlignment !== undefined) {
    style.textAlign = H_ALIGN[props.horizontalAlignment] ?? 'left';
  }
  // Honor embedded newlines (Godot treats `\n` as a hard break regardless of
  // autowrap); autowrap additionally soft-wraps long lines. Godot's modes:
  // 0 off, 1 ARBITRARY (break anywhere), 2 WORD, 3 WORD_SMART (break a word
  // that can't fit). `pre`/`pre-wrap` preserve the newlines either way.
  applyAutowrap(style, props.autowrapMode);
  if (props.uppercase) style.textTransform = 'uppercase';
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
      {children}
    </div>
  );
}

/** Map Godot's autowrap_mode to white-space + word-break CSS. */
function applyAutowrap(style: CSSProperties, mode: number | undefined): void {
  switch (mode) {
    case 1: // AUTOWRAP_ARBITRARY — break at any character
      style.whiteSpace = 'pre-wrap';
      style.wordBreak = 'break-all';
      break;
    case 2: // AUTOWRAP_WORD — break only at word boundaries
      style.whiteSpace = 'pre-wrap';
      break;
    case 3: // AUTOWRAP_WORD_SMART — break words that can't fit on one line
      style.whiteSpace = 'pre-wrap';
      style.overflowWrap = 'break-word';
      break;
    default: // 0 / absent — no soft wrapping (newlines still honored)
      style.whiteSpace = 'pre';
  }
}
