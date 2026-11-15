/**
 * Parses a Parallax2D: the Node2D surface plus the scroll group. `autoscroll` is not read: it
 * runs only in a running game (`parallax_2d.cpp:98-100`), so a still frame shows none.
 * `repeat_size` and `repeat_times` clamp as their setters do (`:165`, `:181`).
 */

import type { ParsedHeading } from '../../../parser/utils';
import { boolOr, intOr, vec2Or } from '../../../parser/valueParsers';
import { parseNode2D } from '../../base/node2d/parser';
import type { Parallax2DProperties } from './types';

/** `Parallax2D::DEFAULT_LIMIT` (`parallax_2d.h:38`). */
const DEFAULT_LIMIT = 10000000;

export function parseParallax2D(
  heading: ParsedHeading,
  properties: Record<string, string>
): Parallax2DProperties {
  const base = parseNode2D(heading, properties);
  const context = base.name || 'Parallax2D';
  const repeatSize = vec2Or(properties.repeat_size, { x: 0, y: 0 }, context);
  return {
    ...base,
    scroll_scale: vec2Or(properties.scroll_scale, { x: 1, y: 1 }, context),
    scroll_offset: vec2Or(properties.scroll_offset, { x: 0, y: 0 }, context),
    screen_offset: vec2Or(properties.screen_offset, { x: 0, y: 0 }, context),
    repeat_size: { x: Math.max(0, repeatSize.x), y: Math.max(0, repeatSize.y) },
    repeat_times: Math.max(1, intOr(properties.repeat_times, 1, context)),
    limit_begin: vec2Or(properties.limit_begin, { x: -DEFAULT_LIMIT, y: -DEFAULT_LIMIT }, context),
    limit_end: vec2Or(properties.limit_end, { x: DEFAULT_LIMIT, y: DEFAULT_LIMIT }, context),
    follow_viewport: boolOr(properties.follow_viewport, true, context),
    ignore_camera_scroll: boolOr(properties.ignore_camera_scroll, false, context),
  };
}
