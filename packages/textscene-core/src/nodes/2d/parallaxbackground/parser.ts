/**
 * ParallaxBackground parser.
 *
 * A CanvasLayer, so it does NOT delegate to `parseNode2D`: the placement props
 * are the CanvasLayer set (`offset`/`rotation`/`scale`, or the composite
 * `transform`), and there is no `z_index`/`modulate`/`y_sort_enabled` surface at
 * all. `transform` wins when present — `CanvasLayer::_bind_methods` registers it
 * after offset/rotation/scale, so Godot's serializer writes it last and the last
 * property applied is the one that survives (`set_transform` stores the matrix
 * directly; `set_offset`/`set_scale` rebuild it from loc/rot/scale).
 *
 * `layer` defaults to **-100**, not 0: `ParallaxBackground::ParallaxBackground()`
 * runs `set_layer(-100)` ("behind all by default"), and a `.tscn` omits any
 * property equal to the class default — so the corpus's five ParallaxBackgrounds
 * all leave it out.
 */

import type { ParsedHeading } from '../../../parser/utils';
import { boolOr, floatOr, intOr, vec2Or } from '../../../parser/valueParsers';
import { decomposeTransform2D } from '../../base/node2d/parser';
import type { Vector2 } from '../../base/node2d/types';
import type { ParallaxBackgroundProperties } from './types';

/** `ParallaxBackground::ParallaxBackground()` — `set_layer(-100)`. */
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
    index: heading.attributes.index ? Number(heading.attributes.index) : undefined,
    visible: properties.visible === undefined ? undefined : properties.visible !== 'false',
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
