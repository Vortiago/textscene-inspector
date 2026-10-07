/**
 * Parses a ParallaxBackground, a CanvasLayer, so not through `parseNode2D`: the
 * placement is the CanvasLayer's canvas transform, and no `z_index`, `modulate` or
 * `y_sort_enabled` exists.
 */

import type { ParsedHeading } from '../../../parser/utils';
import { boolOr, floatOr, intOr, vec2Or, parseHeadingIndex } from '../../../parser/valueParsers';
import { parseCanvasLayerTransform } from '../ui/canvaslayer/parser';
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

  return {
    name,
    parent: heading.attributes.parent,
    instance: heading.attributes.instance,
    index: parseHeadingIndex(heading.attributes.index),
    visible: properties.visible === undefined ? undefined : boolSlotValue(properties.visible) !== false,
    layer: intOr(properties.layer, PARALLAX_BACKGROUND_LAYER, context),
    canvasTransform: parseCanvasLayerTransform(properties, name),
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
