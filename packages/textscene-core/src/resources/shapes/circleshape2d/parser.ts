/** CircleShape2D collision-shape resource parser. */

import { floatOr } from '../../../parser/valueParsers';

export interface CircleShape2DProperties {
  /** Circle radius. Godot default is 10. */
  radius: number;
}

export function parseCircleShape2D(properties: Record<string, string>): CircleShape2DProperties {
  return { radius: floatOr(properties.radius, 10, 'CircleShape2D') };
}
