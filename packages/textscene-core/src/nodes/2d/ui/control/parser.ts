/** Base Control parser — layout + theme-override properties shared by all 2D UI nodes. */

import type { ParsedHeading } from '../../../../parser/utils';
import type { ControlProperties, ControlColor } from './types';
import { parseColor } from '../../../../utils/colorParser';
import { parseOptionalVector2 } from '../../../../parser/valueParsers';
import { COLOR_RE } from '../../../../parser/vectors';

function num(raw: string | undefined): number | undefined {
  if (raw === undefined) return undefined;
  const n = parseFloat(raw);
  return Number.isNaN(n) ? undefined : n;
}

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
        const n = parseFloat(value);
        if (!Number.isNaN(n)) constants[name!] = n;
        break;
      }
      case 'colors':
        if (COLOR_RE.test(value)) {
          colors[name!] = parseColor(value);
        }
        break;
      case 'font_sizes': {
        const n = parseFloat(value);
        if (!Number.isNaN(n)) fontSizes[name!] = n;
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

  result.layoutMode = num(properties.layout_mode);
  result.anchorsPreset = num(properties.anchors_preset);
  result.anchorLeft = num(properties.anchor_left);
  result.anchorTop = num(properties.anchor_top);
  result.anchorRight = num(properties.anchor_right);
  result.anchorBottom = num(properties.anchor_bottom);
  result.offsetLeft = num(properties.offset_left);
  result.offsetTop = num(properties.offset_top);
  result.offsetRight = num(properties.offset_right);
  result.offsetBottom = num(properties.offset_bottom);
  result.growHorizontal = num(properties.grow_horizontal);
  result.growVertical = num(properties.grow_vertical);
  result.sizeFlagsHorizontal = num(properties.size_flags_horizontal);
  result.sizeFlagsVertical = num(properties.size_flags_vertical);
  result.sizeFlagsStretchRatio = num(properties.size_flags_stretch_ratio);
  result.customMinimumSize = parseOptionalVector2(properties.custom_minimum_size);

  Object.assign(result, parseThemeOverrides(properties));

  return result;
}
