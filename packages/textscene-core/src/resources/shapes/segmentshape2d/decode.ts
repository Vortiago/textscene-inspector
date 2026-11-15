/** SegmentShape2D decode: property bag in, the two end points out. Neither setter validates. */

import { vec2Or } from '../../../parser/valueParsers';
import type { SegmentShape2DProperties } from './types';

export function decodeSegmentShape2D(properties: Record<string, string>): SegmentShape2DProperties {
  return {
    a: vec2Or(properties.a, { x: 0, y: 0 }, 'SegmentShape2D a'),
    b: vec2Or(properties.b, { x: 0, y: 10 }, 'SegmentShape2D b'),
  };
}
