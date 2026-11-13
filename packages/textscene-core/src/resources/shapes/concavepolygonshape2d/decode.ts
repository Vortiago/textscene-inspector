/**
 * ConcavePolygonShape2D decode: `segments` in, the segment end points out. Malformed or
 * hand-edited data degrades to no segments, which draws nothing, rather than throwing through
 * the render tree.
 */

import { packedOr } from '../../../parser/valueParsers';
import { NO_FLOATS, parsePackedVector2Array, vector2Elements } from '../packedArray';
import type { ConcavePolygonShape2DProperties } from './types';

export function decodeConcavePolygonShape2D(
  properties: Record<string, string>
): ConcavePolygonShape2DProperties {
  return {
    segments: vector2Elements(
      packedOr(properties.segments, parsePackedVector2Array, NO_FLOATS, 'ConcavePolygonShape2D segments')
    ),
  };
}
