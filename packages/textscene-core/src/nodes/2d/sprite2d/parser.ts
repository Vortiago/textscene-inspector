/**
 * Sprite2D parser — Node2D transform + the textured-quad surface (texture,
 * centering/offset, flip, region, sprite-sheet frames, modulate). Defaults
 * follow Godot: centered = true, hframes = vframes = 1, modulate = white.
 */

import type { ParsedHeading } from '../../../parser/utils';
import { parseNode2D } from '../../base/node2d/parser';
import { boolOr, intOr, parseOptionalVector2i, vec2Or } from '../../../parser/valueParsers';
import { warn } from '../../../logger';
import type { Rect2, Sprite2DProperties } from './types';

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
    const r = parseRect2(properties.region_rect);
    if (r) result.region_rect = r;
  }

  return result;
}

function parseRect2(value: string): Rect2 | null {
  const m = value.match(
    /^Rect2\(\s*(-?[\d.eE+-]+)\s*,\s*(-?[\d.eE+-]+)\s*,\s*(-?[\d.eE+-]+)\s*,\s*(-?[\d.eE+-]+)\s*\)$/
  );
  if (!m) {
    warn(`Sprite2D: invalid region_rect Rect2 "${value}"`);
    return null;
  }
  return { x: parseFloat(m[1]!), y: parseFloat(m[2]!), width: parseFloat(m[3]!), height: parseFloat(m[4]!) };
}
