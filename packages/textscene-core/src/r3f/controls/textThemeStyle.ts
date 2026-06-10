/**
 * Map a Control's theme font overrides to CSS. Text Controls each repeat the
 * same `theme_override_font_sizes/<size> → fontSize` and
 * `theme_override_colors/<color> → color` extraction; only the override key
 * names differ (Label/Button use `font_size`/`font_color`, RichTextLabel uses
 * `normal_font_size`/`default_color`), so they are passed in.
 */
import type { CSSProperties } from 'react';
import { controlColorToCss } from './styleBoxToCss';
import type { ControlColor } from '../../nodes/2d/ui/control/types';

interface TextThemeProps {
  themeOverrideFontSizes?: Record<string, number>;
  themeOverrideColors?: Record<string, ControlColor>;
}

export function textThemeStyle(
  props: TextThemeProps,
  keys: { sizeKey: string; colorKey: string }
): CSSProperties {
  const style: CSSProperties = {};
  const fontSize = props.themeOverrideFontSizes?.[keys.sizeKey];
  if (fontSize) style.fontSize = `${fontSize}px`;
  const fontColor = props.themeOverrideColors?.[keys.colorKey];
  if (fontColor) style.color = controlColorToCss(fontColor);
  return style;
}
