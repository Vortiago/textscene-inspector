/** Base Control parser — layout + theme-override properties shared by all 2D UI nodes. */

import type { ParsedHeading } from '../../../../parser/utils';
import { unquoteStringName } from '../../../../parser/utils';
import type { ControlProperties, ControlColor } from './types';
import { parseColorOrUndefined } from '../../../../utils/colorParser';
import { intOr, parseOptionalFloat, parseOptionalVector2, parseHeadingIndex } from '../../../../parser/valueParsers';
import { boolSlotValue } from '../../../../godot/index.js';

/** Collect `theme_override_<category>/<name> = value` into the five typed maps. */
function parseThemeOverrides(properties: Record<string, string>): Partial<ControlProperties> {
  const constants: Record<string, number> = {};
  const colors: Record<string, ControlColor> = {};
  const fontSizes: Record<string, number> = {};
  const styles: Record<string, string> = {};
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
      case 'fonts':
        fonts[name!] = value;
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
  if (Object.keys(fonts).length) out.themeOverrideFonts = fonts;
  return out;
}

/** An empty `theme_type_variation` means "no variation", not a variation named "". */
function parseThemeTypeVariation(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  const name = unquoteStringName(value);
  return name === '' ? undefined : name;
}

export function parseControl(
  heading: ParsedHeading,
  properties: Record<string, string>
): ControlProperties {
  const result: ControlProperties = { name: heading.attributes.name || '' };

  if (heading.attributes.parent) result.parent = heading.attributes.parent;
  if (heading.attributes.instance) result.instance = heading.attributes.instance;
  const index = parseHeadingIndex(heading.attributes.index);
  if (index !== undefined) result.index = index;
  if (properties.visible !== undefined) result.visible = boolSlotValue(properties.visible) !== false;

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

  // CanvasItem tint + the Control's own 2D transform. Both were dropped for the
  // whole 2D UI family; `rotation` is radians in the file, degrees only in the
  // inspector.
  result.modulate = parseColorOrUndefined(properties.modulate);
  result.selfModulate = parseColorOrUndefined(properties.self_modulate);
  result.rotation = parseOptionalFloat(properties.rotation);
  result.scale = parseOptionalVector2(properties.scale);
  result.pivotOffset = parseOptionalVector2(properties.pivot_offset);
  result.pivotOffsetRatio = parseOptionalVector2(properties.pivot_offset_ratio);

  // CanvasItem draw-order + sampler properties (mirrors node2d/parser.ts's
  // z_index/show_behind_parent/light_mask reads: same helpers, same Godot
  // defaults). Never left undefined — an unset Control has these values in
  // real Godot too, so the parsed type should not lie about it.
  result.zIndex = intOr(properties.z_index, 0);
  result.showBehindParent = boolSlotValue(properties.show_behind_parent) === true;
  result.lightMask = intOr(properties.light_mask, 1, `${result.name || 'Control'}.light_mask`);
  result.textureFilter = intOr(
    properties.texture_filter,
    0,
    `${result.name || 'Control'}.texture_filter`
  );
  result.textureRepeat = intOr(
    properties.texture_repeat,
    0,
    `${result.name || 'Control'}.texture_repeat`
  );

  Object.assign(result, parseThemeOverrides(properties));

  // `theme = ExtResource(...)`/`SubResource(...)` — raw, resolved downstream
  // the same way `themeOverrideStyles`' refs are (`SubResourceResolver`).
  if (properties.theme !== undefined) result.theme = properties.theme;
  result.themeTypeVariation = parseThemeTypeVariation(properties.theme_type_variation);

  return result;
}
