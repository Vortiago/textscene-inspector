/**
 * Sprite2D parser — Node2D transform + the textured-quad surface (texture,
 * centering/offset, flip, region, sprite-sheet frames, modulate). Defaults
 * follow Godot: centered = true, hframes = vframes = 1, modulate = white.
 */

import type { ParsedHeading } from '../../../parser/utils';
import { parseNode2D } from '../../base/node2d/parser';
import { boolOr, parseOptionalRect2, vec2Or } from '../../../parser/valueParsers';
import { frameCoords, replaySpriteFrames } from '../../../godot/spriteFrames.js';
import type { Sprite2DProperties } from './types';

export function parseSprite2D(
  heading: ParsedHeading,
  properties: Record<string, string>
): Sprite2DProperties {
  const base = parseNode2D(heading, properties);
  const frames = replaySpriteFrames(properties);

  const result: Sprite2DProperties = {
    ...base,
    centered: boolOr(properties.centered, true),
    offset: vec2Or(properties.offset, { x: 0, y: 0 }, 'Sprite2D'),
    flip_h: boolOr(properties.flip_h, false),
    flip_v: boolOr(properties.flip_v, false),
    region_enabled: boolOr(properties.region_enabled, false),
    // The grid and frame Godot HOLDS after replaying the body in file order —
    // a refused `frame` stays 0, a later `hframes` re-maps one that landed
    // (godot/spriteFrames.ts).
    hframes: frames.hframes,
    vframes: frames.vframes,
    frame: frames.frame,
    // `modulate` is parsed by parseNode2D (CanvasItem property) — inherited via ...base.
  };

  if (properties.texture) result.texture = properties.texture;
  // Kept as the stored frame's own coordinates: the renderer prefers this
  // field, and the authored pair may have been refused or re-mapped.
  if (frames.writes.some((w) => w.key === 'frame_coords')) result.frame_coords = frameCoords(frames);
  if (properties.region_rect) {
    const r = parseOptionalRect2(properties.region_rect, 'Sprite2D region_rect');
    if (r) result.region_rect = r;
  }

  return result;
}

