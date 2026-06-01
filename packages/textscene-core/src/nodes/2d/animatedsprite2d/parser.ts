/**
 * AnimatedSprite2D parser — Node2D transform + the SpriteFrames playback
 * surface (sprite_frames ref, current animation name, frame index, centering,
 * flip). The SpriteFrames resource itself is parsed lazily at render time
 * (see spriteFrames.ts) from the resolved sub/ext resource.
 */

import type { ParsedHeading } from '../../../parser/utils';
import { parseNode2D } from '../../base/node2d/parser';
import { parseVector2 } from '../../../parser/vectors';
import { warn } from '../../../logger';
import type { AnimatedSprite2DProperties } from './types';
import type { Vector2 } from '../../base/node2d/types';

export function isAnimatedSprite2D(heading: ParsedHeading): boolean {
  return heading.type === 'node' && heading.attributes.type === 'AnimatedSprite2D';
}

export function parseAnimatedSprite2D(
  heading: ParsedHeading,
  properties: Record<string, string>
): AnimatedSprite2DProperties {
  const base = parseNode2D(heading, properties);
  const result: AnimatedSprite2DProperties = {
    ...base,
    frame: intOr(properties.frame, 0),
    centered: boolOr(properties.centered, true),
    offset: vec2Or(properties.offset, { x: 0, y: 0 }),
    flip_h: boolOr(properties.flip_h, false),
    flip_v: boolOr(properties.flip_v, false),
  };
  if (properties.sprite_frames) result.sprite_frames = properties.sprite_frames;
  // `animation = &"right"` → "right".
  if (properties.animation) result.animation = properties.animation.replace(/^&?"(.*)"$/, '$1');
  return result;
}

function intOr(value: string | undefined, fallback: number): number {
  if (value === undefined) return fallback;
  const parsed = parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

function boolOr(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  const v = value.toLowerCase();
  if (v === 'true' || v === '1') return true;
  if (v === 'false' || v === '0') return false;
  return fallback;
}

function vec2Or(value: string | undefined, fallback: Vector2): Vector2 {
  if (!value) return fallback;
  try {
    return parseVector2(value);
  } catch {
    warn(`AnimatedSprite2D: invalid Vector2 "${value}"`);
    return fallback;
  }
}
