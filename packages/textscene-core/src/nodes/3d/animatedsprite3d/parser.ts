/** AnimatedSprite3D parser: the GeometryInstance3D base and the SpriteBase3D quad placement. */

import type { ParsedHeading } from '../../../parser/utils';
import { parseGeometryInstance3D } from '../geometryinstance3d/parser';
import { parseSpriteQuad } from '../sprite3d/quadParser';
import type { AnimatedSprite3DProperties } from './types';

export function parseAnimatedSprite3D(
  heading: ParsedHeading,
  properties: Record<string, string>
): AnimatedSprite3DProperties {
  return {
    ...parseGeometryInstance3D(heading, properties),
    ...parseSpriteQuad(properties, 'AnimatedSprite3D'),
  };
}
