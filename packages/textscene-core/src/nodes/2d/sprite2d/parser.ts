/**
 * Sprite2D parser — Node2D transform + the textured-quad surface (texture,
 * centering/offset, flip, region, sprite-sheet frames, modulate). Defaults
 * follow Godot: centered = true, hframes = vframes = 1, modulate = white.
 */

import type { ParsedHeading } from '../../../parser/utils';
import { parseNode2D } from '../../base/node2d/parser';
import {
  boolOr,
  intOr,
  parseOptionalRect2,
  parseOptionalVector2i,
  vec2Or,
} from '../../../parser/valueParsers';
import type { Sprite2DProperties } from './types';

export function parseSprite2D(
  heading: ParsedHeading,
  properties: Record<string, string>
): Sprite2DProperties {
  const base = parseNode2D(heading, properties);

  const result: Sprite2DProperties = {
    ...base,
    centered: boolOr(properties.centered, true),
    offset: vec2Or(properties.offset, { x: 0, y: 0 }, 'Sprite2D'),
    flip_h: boolOr(properties.flip_h, false),
    flip_v: boolOr(properties.flip_v, false),
    region_enabled: boolOr(properties.region_enabled, false),
    hframes: Math.max(1, intOr(properties.hframes, 1)),
    vframes: Math.max(1, intOr(properties.vframes, 1)),
    frame: intOr(properties.frame, 0),
    // `modulate` is parsed by parseNode2D (CanvasItem property) — inherited via ...base.
  };

  if (properties.texture) result.texture = properties.texture;
  if (properties.frame_coords) {
    const c = parseOptionalVector2i(properties.frame_coords, 'Sprite2D frame_coords');
    if (c) result.frame_coords = c;
  }
  if (properties.region_rect) {
    const r = parseOptionalRect2(properties.region_rect, 'Sprite2D region_rect');
    if (r) result.region_rect = r;
  }

  return result;
}

