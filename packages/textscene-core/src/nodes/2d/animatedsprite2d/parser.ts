/**
 * AnimatedSprite2D parser: the Node2D transform and the SpriteFrames playback
 * properties. The SpriteFrames resource itself decodes at render time, from the
 * resolved sub- or ext-resource.
 */

import type { ParsedHeading } from '../../../parser/utils';
import { parseNode2D } from '../../base/node2d/parser';
import { boolOr, intOr, vec2Or } from '../../../parser/valueParsers';
import type { AnimatedSprite2DProperties } from './types';

export function parseAnimatedSprite2D(
  heading: ParsedHeading,
  properties: Record<string, string>
): AnimatedSprite2DProperties {
  const base = parseNode2D(heading, properties);
  const result: AnimatedSprite2DProperties = {
    ...base,
    frame: intOr(properties.frame, 0),
    centered: boolOr(properties.centered, true),
    offset: vec2Or(properties.offset, { x: 0, y: 0 }, 'AnimatedSprite2D'),
    flip_h: boolOr(properties.flip_h, false),
    flip_v: boolOr(properties.flip_v, false),
  };
  if (properties.sprite_frames) result.sprite_frames = properties.sprite_frames;
  // `animation = &"right"` → "right".
  if (properties.animation) result.animation = properties.animation.replace(/^&?"(.*)"$/, '$1');
  return result;
}
