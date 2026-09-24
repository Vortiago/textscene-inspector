/**
 * Parses a ParallaxBackground, a CanvasLayer, so not through `parseNode2D`: the
 * placement is `offset`, `rotation` and `scale`, or `transform`, and no
 * `z_index`, `modulate` or `y_sort_enabled` exists.
 */

import type { ParsedHeading } from '../../../parser/utils';
import { boolOr, floatOr, intOr, vec2Or, parseHeadingIndex } from '../../../parser/valueParsers';
import { decomposeTransform2D } from '../../base/node2d/parser';
import type { Vector2 } from '../../base/node2d/types';
import type { ParallaxBackgroundProperties } from './types';
import { boolSlotValue } from '../../../godot/index.js';

/**
 * `ParallaxBackground::ParallaxBackground()` runs `set_layer(-100)`, and a
 * `.tscn` omits a value equal to the class default, so `layer` is often absent.
 */
export const PARALLAX_BACKGROUND_LAYER = -100;

export function parseParallaxBackground(
  heading: ParsedHeading,
  properties: Record<string, string>
): ParallaxBackgroundProperties {
  const name = heading.attributes.name || '';
  const context = name || 'ParallaxBackground';

  let offset: Vector2 = { x: 0, y: 0 };
  let rotation = 0;
  let scale: Vector2 = { x: 1, y: 1 };
  // `_bind_methods` registers `transform` after offset, rotation and scale, so
  // Godot writes it last and it wins: `set_transform` stores the matrix directly.
  const matrix = properties.transform ? decomposeTransform2D(properties.transform, name) : null;
  if (matrix) {
    offset = matrix.position;
    rotation = matrix.rotation;
    scale = matrix.scale;
  } else {
    offset = vec2Or(properties.offset, offset, context);
    scale = vec2Or(properties.scale, scale, context);
    if (properties.rotation !== undefined) rotation = floatOr(properties.rotation, 0, context);
  }

  return {
    name,
    parent: heading.attributes.parent,
    instance: heading.attributes.instance,
    index: parseHeadingIndex(heading.attributes.index),
    visible: properties.visible === undefined ? undefined : boolSlotValue(properties.visible) !== false,
    layer: intOr(properties.layer, PARALLAX_BACKGROUND_LAYER, context),
    offset,
    rotation,
    scale,
    follow_viewport_enabled: boolOr(properties.follow_viewport_enabled, false, context),
    follow_viewport_scale: floatOr(properties.follow_viewport_scale, 1, context),
    scroll_offset: vec2Or(properties.scroll_offset, { x: 0, y: 0 }, context),
    scroll_base_offset: vec2Or(properties.scroll_base_offset, { x: 0, y: 0 }, context),
    scroll_base_scale: vec2Or(properties.scroll_base_scale, { x: 1, y: 1 }, context),
    scroll_limit_begin: vec2Or(properties.scroll_limit_begin, { x: 0, y: 0 }, context),
    scroll_limit_end: vec2Or(properties.scroll_limit_end, { x: 0, y: 0 }, context),
    scroll_ignore_camera_zoom: boolOr(properties.scroll_ignore_camera_zoom, false, context),
  };
}
