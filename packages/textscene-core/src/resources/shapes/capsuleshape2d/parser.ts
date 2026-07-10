/** CapsuleShape2D collision-shape resource parser. */

import { floatOr } from '../../../parser/valueParsers';

export interface CapsuleShape2DProperties {
  /** Capsule radius. Godot default is 10. */
  radius: number;
  /** Capsule full height (including the semicircular caps). Godot default is 30. */
  height: number;
}

export function parseCapsuleShape2D(properties: Record<string, string>): CapsuleShape2DProperties {
  return {
    radius: floatOr(properties.radius, 10, 'CapsuleShape2D'),
    height: floatOr(properties.height, 30, 'CapsuleShape2D'),
  };
}
