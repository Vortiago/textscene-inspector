/**
 * <RichTextLabel> — a positioned <div> holding the node's text. BBCode tags are
 * stripped for a best-effort plain-text render. Font size/color come from
 * `theme_override_font_sizes/normal_font_size` + `theme_override_colors/default_color`;
 * a system font stack is used (the VS Code webview CSP blocks web fonts).
 */

import type { CSSProperties } from 'react';
import type { ControlComponentProps } from '../../../../r3f/controls/ControlComponentRegistry';
import { useControlParent } from '../../../../r3f/controls/ControlParentContext';
import { controlLayoutStyle } from '../../../../r3f/controls/controlLayout';
import { controlColorToCss } from '../../../../r3f/controls/styleBoxToCss';
import type { RichTextLabelProperties } from './types';

export function RichTextLabel({ node }: ControlComponentProps) {
  const props = node.properties as RichTextLabelProperties;
  const parentKind = useControlParent();
  const style: CSSProperties = { ...controlLayoutStyle(props, parentKind), whiteSpace: 'pre-wrap' };

  const fontSize = props.themeOverrideFontSizes?.normal_font_size;
  if (fontSize) style.fontSize = `${fontSize}px`;
  const fontColor = props.themeOverrideColors?.default_color;
  if (fontColor) style.color = controlColorToCss(fontColor);

  const plain = (props.text ?? '').replace(/\[\/?[^\]]+\]/g, '');

  return (
    <div data-control-type="RichTextLabel" data-node-name={node.name} style={style}>
      {plain}
    </div>
  );
}
