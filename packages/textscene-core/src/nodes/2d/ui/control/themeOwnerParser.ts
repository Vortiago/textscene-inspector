/**
 * The theme a Control or a Window owns, read from its scene lines. Its own module, so a Window parse
 * reads these keys and none of the Control layout keys.
 */

import { unquoteStringName } from '../../../../parser/utils';
import { parseOptionalFloat } from '../../../../parser/valueParsers';
import { parseColorOrUndefined } from '../../../../utils/colorParser';
import type { Rgba } from '../../../../godot/math/math.js';
import type { ThemeOwnerFields } from './types';

/** Collect `theme_override_<category>/<name> = value` into the six typed maps. */
function parseThemeOverrides(properties: Record<string, string>): ThemeOwnerFields {
  const constants: Record<string, number> = {};
  const colors: Record<string, Rgba> = {};
  const fontSizes: Record<string, number> = {};
  const styles: Record<string, string> = {};
  const icons: Record<string, string> = {};
  const fonts: Record<string, string> = {};

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
      case 'icons':
        icons[name!] = value;
        break;
      case 'fonts':
        fonts[name!] = value;
        break;
      default:
        break;
    }
  }

  const out: ThemeOwnerFields = {};
  if (Object.keys(constants).length) out.themeOverrideConstants = constants;
  if (Object.keys(colors).length) out.themeOverrideColors = colors;
  if (Object.keys(fontSizes).length) out.themeOverrideFontSizes = fontSizes;
  if (Object.keys(styles).length) out.themeOverrideStyles = styles;
  if (Object.keys(icons).length) out.themeOverrideIcons = icons;
  if (Object.keys(fonts).length) out.themeOverrideFonts = fonts;
  return out;
}

/** An empty `theme_type_variation` means "no variation", not a variation named "". */
function parseThemeTypeVariation(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  const name = unquoteStringName(value);
  return name === '' ? undefined : name;
}

/** The theme a Control or a Window owns: its overrides, its own Theme and its type variation. */
export function parseThemeOwnerFields(properties: Record<string, string>): ThemeOwnerFields {
  const fields = parseThemeOverrides(properties);
  // Raw, and resolved later by `SubResourceResolver`, as `themeOverrideStyles` is.
  if (properties.theme !== undefined) fields.theme = properties.theme;
  fields.themeTypeVariation = parseThemeTypeVariation(properties.theme_type_variation);
  return fields;
}
