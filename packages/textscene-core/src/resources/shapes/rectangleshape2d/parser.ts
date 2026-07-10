/** RectangleShape2D collision-shape resource parser. */

import { vec2Or } from '../../../parser/valueParsers';

export interface RectangleShape2DProperties {
  /** Rectangle width/height. Godot default is Vector2(20, 20). */
  size: { x: number; y: number };
}

export function parseRectangleShape2D(properties: Record<string, string>): RectangleShape2DProperties {
  return { size: vec2Or(properties.size, { x: 20, y: 20 }, 'RectangleShape2D') };
}
