/**
 * CircleShape2D decode: property bag in, circle radius out.
 *
 * `circle_shape_2d.cpp:46` ERR_FAILs a negative radius, so one is refused rather
 * than stored.
 */

import { nonNegativeOr } from '../../../parser/valueParsers';
import type { CircleShape2DProperties } from './types';

export function decodeCircleShape2D(properties: Record<string, string>): CircleShape2DProperties {
  return { radius: nonNegativeOr(properties.radius, 10, 'CircleShape2D radius') };
}
