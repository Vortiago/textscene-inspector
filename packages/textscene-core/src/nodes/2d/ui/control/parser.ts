/** Base Control parser: the layout and theme-override properties of every 2D UI node. */

import type { ParsedHeading } from '../../../../parser/utils';
import type { ControlCanvasItemFields, ControlProperties } from './types';
import { parseThemeOwnerFields } from './themeOwnerParser';
import { parseColorOrUndefined } from '../../../../utils/colorParser';
import {
  intOr,
  parseOptionalFloat,
  parseOptionalVector2,
  parseHeadingIndex,
} from '../../../../parser/valueParsers';
import { CanvasItemTextureFilter, CanvasItemTextureRepeat } from '../../../../godot/scene/canvasItem.js';
import { LayoutDirection } from '../../../../godot/scene/control.js';
import { boolSlotValue } from '../../../../godot/variant/variantBool.js';

/**
 * The CanvasItem fields, never undefined, as in `node2d/parser.ts`: an unset Control holds the Godot
 * defaults. An internal Control with no scene node, such as TabContainer's bar, reads them from `{}`.
 */
export function parseControlCanvasItem(
  properties: Record<string, string>,
  name: string
): ControlCanvasItemFields {
  const label = name || 'Control';
  return {
    zIndex: intOr(properties.z_index, 0),
    zAsRelative: boolSlotValue(properties.z_as_relative) !== false,
    showBehindParent: boolSlotValue(properties.show_behind_parent) === true,
    topLevel: boolSlotValue(properties.top_level) === true,
    lightMask: intOr(properties.light_mask, 1, `${label}.light_mask`),
    useParentMaterial: boolSlotValue(properties.use_parent_material) === true,
    textureFilter: intOr(
      properties.texture_filter,
      CanvasItemTextureFilter.PARENT_NODE,
      `${label}.texture_filter`
    ),
    textureRepeat: intOr(
      properties.texture_repeat,
      CanvasItemTextureRepeat.PARENT_NODE,
      `${label}.texture_repeat`
    ),
  };
}

export function parseControl(heading: ParsedHeading, properties: Record<string, string>): ControlProperties {
  const name = heading.attributes.name || '';
  const result: ControlProperties = { name, ...parseControlCanvasItem(properties, name) };

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
  // Never left undefined: an unset Control holds INHERITED in Godot too.
  result.layoutDirection = intOr(
    properties.layout_direction,
    LayoutDirection.INHERITED,
    `${result.name || 'Control'}.layout_direction`
  );
  result.growVertical = parseOptionalFloat(properties.grow_vertical);
  result.localizeNumeralSystem = boolSlotValue(properties.localize_numeral_system);
  result.sizeFlagsHorizontal = parseOptionalFloat(properties.size_flags_horizontal);
  result.sizeFlagsVertical = parseOptionalFloat(properties.size_flags_vertical);
  result.sizeFlagsStretchRatio = parseOptionalFloat(properties.size_flags_stretch_ratio);
  result.customMinimumSize = parseOptionalVector2(properties.custom_minimum_size);

  // `rotation` is radians in the file and degrees only in the inspector.
  result.modulate = parseColorOrUndefined(properties.modulate);
  result.selfModulate = parseColorOrUndefined(properties.self_modulate);
  result.rotation = parseOptionalFloat(properties.rotation);
  result.scale = parseOptionalVector2(properties.scale);
  result.pivotOffset = parseOptionalVector2(properties.pivot_offset);
  result.pivotOffsetRatio = parseOptionalVector2(properties.pivot_offset_ratio);

  if (properties.material !== undefined) result.materialPath = properties.material;

  return Object.assign(result, parseThemeOwnerFields(properties));
}
