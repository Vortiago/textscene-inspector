/** Base Control parser — layout + theme-override properties shared by all 2D UI nodes. */

import type { ParsedHeading } from '../../../../parser/utils';
import type { ControlProperties, ControlColor } from './types';
import { parseColorOrUndefined } from '../../../../utils/colorParser';
import { parseOptionalFloat, parseOptionalVector2 } from '../../../../parser/valueParsers';

/** Collect `theme_override_<category>/<name> = value` into the four typed maps. */
function parseThemeOverrides(properties: Record<string, string>): Partial<ControlProperties> {
  const constants: Record<string, number> = {};
  const colors: Record<string, ControlColor> = {};
  const fontSizes: Record<string, number> = {};
  const styles: Record<string, string> = {};

  for (const [key, value] of Object.entries(properties)) {
    const m = key.match(/^theme_override_(\w+)\/(.+)$/);
    if (!m) continue;
    const [, category, name] = m;
    switch (category) {
      case 'constants': {
        const n = parseOptionalFloat(value);
        if (n !== undefined) constants[name!] = n;
        break;
      }
      case 'colors': {
        const color = parseColorOrUndefined(value);
        if (color) colors[name!] = color;
        break;
      }
      case 'font_sizes': {
        const n = parseOptionalFloat(value);
        if (n !== undefined) fontSizes[name!] = n;
        break;
      }
      case 'styles':
        styles[name!] = value;
        break;
      default:
        break;
    }
  }

  const out: Partial<ControlProperties> = {};
  if (Object.keys(constants).length) out.themeOverrideConstants = constants;
  if (Object.keys(colors).length) out.themeOverrideColors = colors;
  if (Object.keys(fontSizes).length) out.themeOverrideFontSizes = fontSizes;
  if (Object.keys(styles).length) out.themeOverrideStyles = styles;
  return out;
}

export function parseControl(
  heading: ParsedHeading,
  properties: Record<string, string>
): ControlProperties {
  const result: ControlProperties = { name: heading.attributes.name || '' };

  if (heading.attributes.parent) result.parent = heading.attributes.parent;
  if (heading.attributes.instance) result.instance = heading.attributes.instance;
  if (heading.attributes.index) {
    const idx = parseInt(heading.attributes.index, 10);
    if (!Number.isNaN(idx)) result.index = idx;
  }
  if (properties.visible !== undefined) result.visible = properties.visible !== 'false';

  result.layoutMode = parseOptionalFloat(properties.layout_mode);
  result.anchorsPreset = parseOptionalFloat(properties.anchors_preset);
  result.anchorLeft = parseOptionalFloat(properties.anchor_left);
  result.anchorTop = parseOptionalFloat(properties.anchor_top);
  result.anchorRight = parseOptionalFloat(properties.anchor_right);
  result.anchorBottom = parseOptionalFloat(properties.anchor_bottom);
  result.offsetLeft = parseOptionalFloat(properties.offset_left);
  result.offsetTop = parseOptionalFloat(properties.offset_top);
  result.offsetRight = parseOptionalFloat(properties.offset_right);
  result.offsetBottom = parseOptionalFloat(properties.offset_bottom);
  result.growHorizontal = parseOptionalFloat(properties.grow_horizontal);
  result.growVertical = parseOptionalFloat(properties.grow_vertical);
  result.sizeFlagsHorizontal = parseOptionalFloat(properties.size_flags_horizontal);
  result.sizeFlagsVertical = parseOptionalFloat(properties.size_flags_vertical);
  result.sizeFlagsStretchRatio = parseOptionalFloat(properties.size_flags_stretch_ratio);
  result.customMinimumSize = parseOptionalVector2(properties.custom_minimum_size);

  Object.assign(result, parseThemeOverrides(properties));

  return result;
}
