/**
 * The Shape2D kind: the drawing a collision gizmo makes for any Shape2D, from any origin.
 * `set_shape` takes a `Ref<Shape2D>`, so a resource of another class draws nothing.
 */

import { descendsFromClass } from '../../../godot/classdb/classBaseTypes';
import type { ResourceKind } from '../../reading';
import { decodeCapsuleShape2D } from '../capsuleshape2d/decode';
import { decodeCircleShape2D } from '../circleshape2d/decode';
import { decodeConcavePolygonShape2D } from '../concavepolygonshape2d/decode';
import { decodeConvexPolygonShape2D } from '../convexpolygonshape2d/decode';
import { decodeRectangleShape2D } from '../rectangleshape2d/decode';
import { decodeSegmentShape2D } from '../segmentshape2d/decode';
import { decodeSeparationRayShape2D } from '../separationrayshape2d/decode';
import { decodeWorldBoundaryShape2D } from '../worldboundaryshape2d/decode';
import type { ShapeDrawing } from './drawing';
import {
  capsuleDrawing,
  circleDrawing,
  concavePolygonDrawing,
  convexPolygonDrawing,
  rectangleDrawing,
  segmentDrawing,
  separationRayDrawing,
  worldBoundaryDrawing,
} from './drawings';

type Properties = Readonly<Record<string, string>>;

const DRAWINGS: Readonly<Record<string, (properties: Properties) => ShapeDrawing>> = {
  RectangleShape2D: (properties) => rectangleDrawing(decodeRectangleShape2D(properties)),
  CircleShape2D: (properties) => circleDrawing(decodeCircleShape2D(properties)),
  CapsuleShape2D: (properties) => capsuleDrawing(decodeCapsuleShape2D(properties)),
  SegmentShape2D: (properties) => segmentDrawing(decodeSegmentShape2D(properties)),
  ConvexPolygonShape2D: (properties) => convexPolygonDrawing(decodeConvexPolygonShape2D(properties)),
  ConcavePolygonShape2D: (properties) => concavePolygonDrawing(decodeConcavePolygonShape2D(properties)),
  WorldBoundaryShape2D: (properties) => worldBoundaryDrawing(decodeWorldBoundaryShape2D(properties)),
  SeparationRayShape2D: (properties) => separationRayDrawing(decodeSeparationRayShape2D(properties)),
};

export const SHAPE_2D: ResourceKind<ShapeDrawing> = {
  name: 'Shape2D',
  accepts: (type) => descendsFromClass(type, 'Shape2D'),
  // A Shape2D class of a plugin has no `draw()` here, so it draws nothing.
  decode: ({ type, properties }) => DRAWINGS[type]?.(properties) ?? [],
};
