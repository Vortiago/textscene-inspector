/**
 * Node2D parser for the 2D transform and draw-order surface. Godot writes the placement as discrete
 * `position`/`rotation`/`scale`/`skew` or as one `transform = Transform2D(xx, xy, yx, yy, ox, oy)`
 * (x-axis, y-axis, origin), which wins and is decomposed. Angles are radians, and
 * `rotation_degrees` is converted.
 */

import type { ParsedHeading } from '../../../parser/utils';
import { parseColor } from '../../../utils/colorParser';
import { enumOr, floatOr, intOr, vec2Or, parseHeadingIndex } from '../../../parser/valueParsers';
import { TRANSFORM2D_SLOT_RE, matchedFloat, allFinite } from '../../../godot/variant/number.js';
import { degToRad } from '../../../godot/math/math.js';
import { transform2DDecompose, type Transform2DColumns } from '../../../godot/math/transform2d.js';
import { warn } from '../../../logger';
import type { Node2DProperties } from './types';
import { boolSlotValue } from '../../../godot/variant/variantBool.js';
import type { Vector2 } from '../../../godot/math/vector.js';
import { CanvasItemTextureFilter, CanvasItemTextureRepeat } from '../../../godot/scene/canvasItem.js';

/** The setters refuse a value past `TEXTURE_FILTER_MAX` or `TEXTURE_REPEAT_MAX` (`canvas_item.cpp`), so it keeps PARENT_NODE. */
const TEXTURE_FILTERS = Object.values(CanvasItemTextureFilter);
const TEXTURE_REPEATS = Object.values(CanvasItemTextureRepeat);

export function parseNode2D(heading: ParsedHeading, properties: Record<string, string>): Node2DProperties {
  const name = heading.attributes.name || '';
  const label = name || 'Node2D';
  const visible = properties.visible === undefined ? undefined : boolSlotValue(properties.visible) !== false;

  // Defaults match Godot.
  let position: Vector2 = { x: 0, y: 0 };
  let rotation = 0;
  let scale: Vector2 = { x: 1, y: 1 };
  // Matrix form wins and carries its own (decomposed) skew; the discrete `skew`
  // property only applies in the discrete-props path. Both paths assign, so
  // there is no default to state here.
  let skew: number;

  const matrix = properties.transform ? decomposeTransform2D(properties.transform, name) : null;
  if (matrix) {
    ({ position, rotation, scale } = matrix);
    skew = matrix.skew;
  } else {
    if (properties.position) position = vec2Or(properties.position, position, label);
    if (properties.scale) scale = vec2Or(properties.scale, scale, label);
    if (properties.rotation !== undefined) rotation = floatOr(properties.rotation, 0);
    else if (properties.rotation_degrees !== undefined)
      rotation = degToRad(floatOr(properties.rotation_degrees, 0));
    skew = floatOr(properties.skew, 0);
  }

  return {
    name,
    parent: heading.attributes.parent,
    instance: heading.attributes.instance,
    index: parseHeadingIndex(heading.attributes.index),
    visible,
    position,
    rotation,
    scale,
    skew,
    z_index: intOr(properties.z_index, 0),
    z_as_relative:
      properties.z_as_relative === undefined ? true : boolSlotValue(properties.z_as_relative) !== false,
    show_behind_parent: boolSlotValue(properties.show_behind_parent) === true,
    top_level: boolSlotValue(properties.top_level) === true,
    modulate: properties.modulate ? parseColor(properties.modulate) : { r: 1, g: 1, b: 1, a: 1 },
    self_modulate: properties.self_modulate
      ? parseColor(properties.self_modulate)
      : { r: 1, g: 1, b: 1, a: 1 },
    light_mask: intOr(properties.light_mask, 1, `${label}.light_mask`),
    texture_filter: enumOr(
      properties.texture_filter,
      CanvasItemTextureFilter.PARENT_NODE,
      TEXTURE_FILTERS,
      `${label}.texture_filter`
    ),
    texture_repeat: enumOr(
      properties.texture_repeat,
      CanvasItemTextureRepeat.PARENT_NODE,
      TEXTURE_REPEATS,
      `${label}.texture_repeat`
    ),
    y_sort_enabled: boolSlotValue(properties.y_sort_enabled) === true,
    y_sort_origin: properties.y_sort_origin !== undefined ? floatOr(properties.y_sort_origin, 0) : 0,
    ...(properties.material !== undefined ? { materialPath: properties.material } : {}),
    use_parent_material: boolSlotValue(properties.use_parent_material) === true,
  };
}

/** Decompose `Transform2D(xx, xy, yx, yy, ox, oy)` into position/rotation/scale/skew. */
export function decomposeTransform2D(
  value: string,
  nodeName = ''
): { position: Vector2; rotation: number; scale: Vector2; skew: number } | null {
  const columns = parseTransform2DColumns(value);
  if (!columns) {
    warn(`Node2D${nodeName ? ` "${nodeName}"` : ''}: invalid or non-finite Transform2D "${value}"`);
    return null;
  }
  return transform2DDecompose(columns);
}

/**
 * The columns of a `Transform2D(...)` literal, or null for another value. An overflowing exponent is
 * inside the finite grammar and reads as null too, as it would turn every product into NaN.
 */
export function parseTransform2DColumns(value: string): Transform2DColumns | null {
  const columns = TRANSFORM2D_SLOT_RE.exec(value.trim())
    ?.slice(1, 7)
    .map((capture) => matchedFloat(capture));
  if (!columns || !allFinite(columns)) return null;
  const [a, b, c, d, tx, ty] = columns as [number, number, number, number, number, number];
  return { a, b, c, d, tx, ty };
}
