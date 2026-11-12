/**
 * The Shape2D kind: the outline a collision gizmo draws for any Shape2D, from any origin.
 * `set_shape` takes a `Ref<Shape2D>`, so a resource of another class draws nothing.
 */

import { warn } from '../../../logger';
import { descendsFromClass } from '../../../godot/classdb/classBaseTypes';
import type { Vector2 } from '../../../godot/math/vector';
import type { ResourceKind } from '../../reading';
import { decodeCapsuleShape2D } from '../capsuleshape2d/decode';
import { decodeCircleShape2D } from '../circleshape2d/decode';
import { decodeRectangleShape2D } from '../rectangleshape2d/decode';
import { capsulePoints, circlePoints, rectanglePoints } from './outlines';

/** The size of the rectangle drawn for a Shape2D class that has no outline yet. */
const PLACEHOLDER_SIZE = { x: 20, y: 20 };

export const SHAPE_2D: ResourceKind<Vector2[]> = {
  name: 'Shape2D',
  accepts: (type) => descendsFromClass(type, 'Shape2D'),
  decode: (held) => outlineOf(held.type, held.properties),
};

function outlineOf(type: string, properties: Readonly<Record<string, string>>): Vector2[] {
  switch (type) {
    case 'RectangleShape2D':
      return rectanglePoints(decodeRectangleShape2D(properties).size);
    case 'CircleShape2D':
      return circlePoints(decodeCircleShape2D(properties).radius);
    case 'CapsuleShape2D': {
      const { radius, height } = decodeCapsuleShape2D(properties);
      return capsulePoints(radius, height);
    }
    default:
      warn(`[CollisionShape2D] Unsupported shape type "${type}" — drawing a unit rectangle.`);
      return rectanglePoints(PLACEHOLDER_SIZE);
  }
}
