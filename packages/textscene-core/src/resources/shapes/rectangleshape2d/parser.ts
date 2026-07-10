/** RectangleShape2D collision-shape resource parser. */

import { warn } from '../../../logger';
import { parseVector2 } from '../../../parser/vectors';

export interface RectangleShape2DProperties {
  /** Rectangle width/height. Godot default is Vector2(20, 20). */
  size: { x: number; y: number };
}

export function parseRectangleShape2D(properties: Record<string, string>): RectangleShape2DProperties {
  let size = { x: 20, y: 20 };
  if (properties.size) {
    try {
      size = parseVector2(properties.size);
    } catch (error) {
      warn(`Failed to parse RectangleShape2D size: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  return { size };
}
