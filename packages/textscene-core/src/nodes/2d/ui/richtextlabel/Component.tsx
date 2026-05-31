/**
 * <RichTextLabel> — a positioned <div> holding the node's text. When
 * `bbcode_enabled` is true, a best-effort BBCode subset ([b]/[i]/[u]/[s]/
 * [color]/[center]/[code], ADR-0003) is rendered via parseBBCode; otherwise the
 * text is shown literally (Godot does not strip tags when BBCode is off). Font
 * size/color come from `theme_override_font_sizes/normal_font_size` +
 * `theme_override_colors/default_color`; a system font stack is used (the VS
 * Code webview CSP blocks web fonts).
 */

import type { CSSProperties } from 'react';
import type { ControlComponentProps } from '../../../../r3f/controls/ControlComponentRegistry';
import { useControlParent } from '../../../../r3f/controls/ControlParentContext';
import { controlLayoutStyle } from '../../../../r3f/controls/controlLayout';
import { controlColorToCss } from '../../../../r3f/controls/styleBoxToCss';
import { parseBBCode } from './bbcode';
import type { RichTextLabelProperties } from './types';

export function RichTextLabel({ node }: ControlComponentProps) {
  const props = node.properties as RichTextLabelProperties;
  const parentKind = useControlParent();
  const style: CSSProperties = { ...controlLayoutStyle(props, parentKind), whiteSpace: 'pre-wrap' };

  const fontSize = props.themeOverrideFontSizes?.normal_font_size;
  if (fontSize) style.fontSize = `${fontSize}px`;
  const fontColor = props.themeOverrideColors?.default_color;
  if (fontColor) style.color = controlColorToCss(fontColor);

  const text = props.text ?? '';
  const content = props.bbcodeEnabled ? parseBBCode(text) : text;

  return (
    <div data-control-type="RichTextLabel" data-node-name={node.name} style={style}>
      {content}
    </div>
  );
}
