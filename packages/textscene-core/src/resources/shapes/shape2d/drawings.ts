/**
 * The `draw()` of each Shape2D class (`scene/resources/2d/*_shape_2d.cpp`), as a drawing. Each
 * builder takes the decoded properties of its class and gives the commands in Godot's draw order.
 */

import type { Vector2 } from '../../../godot/math/vector';
import { clamp } from '../../../godot/math/math';
import {
  transform2DBasisXform,
  transform2DFromParts,
  transform2DXform,
} from '../../../godot/math/transform2d';
import type { CapsuleShape2DProperties } from '../capsuleshape2d/types';
import type { CircleShape2DProperties } from '../circleshape2d/types';
import type { ConcavePolygonShape2DProperties } from '../concavepolygonshape2d/types';
import type { ConvexPolygonShape2DProperties } from '../convexpolygonshape2d/types';
import type { RectangleShape2DProperties } from '../rectangleshape2d/types';
import type { SegmentShape2DProperties } from '../segmentshape2d/types';
import type { SeparationRayShape2DProperties } from '../separationrayshape2d/types';
import type { WorldBoundaryShape2DProperties } from '../worldboundaryshape2d/types';
import type { ShapeCommand, ShapeDrawing } from './drawing';
import { capsulePoints, circlePoints, rectanglePoints } from './outlines';

/** A polygon, and with `debug/shapes/collision/draw_2d_outlines` (default on, `scene_tree.cpp:2035`) its outline. */
function filledWithOutline(points: readonly Vector2[]): ShapeDrawing {
  return [
    { kind: 'fill', points, role: 'shape' },
    { kind: 'hairline', points: [...points, points[0]!], role: 'opaque' },
  ];
}

export function rectangleDrawing({ size }: RectangleShape2DProperties): ShapeDrawing {
  return filledWithOutline(rectanglePoints(size));
}

export function circleDrawing({ radius }: CircleShape2DProperties): ShapeDrawing {
  return filledWithOutline(circlePoints(radius));
}

export function capsuleDrawing({ radius, height }: CapsuleShape2DProperties): ShapeDrawing {
  return filledWithOutline(capsulePoints(radius, height));
}

/** `Transform2D::rotate` about `origin`, at unit scale. */
function rotation(angle: number, origin: Vector2 = { x: 0, y: 0 }) {
  return transform2DFromParts(angle, { x: 1, y: 1 }, 0, origin);
}

function line(from: Vector2, to: Vector2, width: number): ShapeCommand {
  return { kind: 'stroke', points: [from, to], width, roles: ['shape', 'shape'] };
}

/** `segment_shape_2d.cpp:74-76`. */
export function segmentDrawing({ a, b }: SegmentShape2DProperties): ShapeDrawing {
  return [line(a, b, 3)];
}

/** `convex_polygon_shape_2d.cpp:104-118`. */
export function convexPolygonDrawing({ points }: ConvexPolygonShape2DProperties): ShapeDrawing {
  return points.length < 3 ? [] : filledWithOutline(points);
}

/** `concave_polygon_shape_2d.cpp:64-75`: nothing for an odd count of points. */
export function concavePolygonDrawing({ segments }: ConcavePolygonShape2DProperties): ShapeDrawing {
  if (segments.length % 2 === 1) return [];
  const lines: ShapeCommand[] = [];
  for (let i = 0; i < segments.length; i += 2) lines.push(line(segments[i]!, segments[i + 1]!, 2));
  return lines;
}

/** The half length of the boundary line that fades out past it (`world_boundary_shape_2d.cpp:95-98`). */
const BOUNDARY_SOLID_HALF = 60;
const BOUNDARY_FADE_HALF = 100;
const BOUNDARY_LINE_WIDTH = 3;

/** `world_boundary_shape_2d.cpp:88-127`: a line along the boundary, and an arrow along the normal. */
export function worldBoundaryDrawing({ normal, distance }: WorldBoundaryShape2DProperties): ShapeDrawing {
  const point = { x: distance * normal.x, y: distance * normal.y };
  const along = { x: normal.y, y: -normal.x };
  const at = (offset: number) => ({ x: point.x - along.x * offset, y: point.y - along.y * offset });
  const boundary: ShapeCommand = {
    kind: 'stroke',
    points: [
      at(BOUNDARY_FADE_HALF),
      at(BOUNDARY_SOLID_HALF),
      at(-BOUNDARY_SOLID_HALF),
      at(-BOUNDARY_FADE_HALF),
    ],
    width: BOUNDARY_LINE_WIDTH,
    roles: ['clear', 'shape', 'shape', 'clear'],
  };

  const toWorld = rotation(Math.atan2(normal.y, normal.x));
  const arrowFrom = distance + BOUNDARY_LINE_WIDTH / 2;
  const arrow: ShapeCommand = {
    kind: 'stroke',
    points: [
      { x: arrowFrom, y: -2.5 },
      { x: distance + 20, y: -2.5 },
      { x: distance + 20, y: -10 },
      { x: distance + 40, y: 0 },
      { x: distance + 20, y: 10 },
      { x: distance + 20, y: 2.5 },
      { x: arrowFrom, y: 2.5 },
    ].map((p) => transform2DXform(toWorld, p)),
    width: BOUNDARY_LINE_WIDTH / 2,
    roles: Array<'inverted'>(7).fill('inverted'),
  };
  return [boundary, arrow];
}

const RAY_MAX_ARROW_SIZE = 6;
const RAY_LINE_WIDTH = 1.4;

/** `separation_ray_shape_2d.cpp:44-71`: a line along +Y that stops where the arrow head begins. */
export function separationRayDrawing({ length }: SeparationRayShape2DProperties): ShapeDrawing {
  const reach = Math.abs(length);
  const hasLine = reach >= RAY_LINE_WIDTH;
  const headSize = hasLine ? clamp((reach * 2) / 3, RAY_LINE_WIDTH, RAY_MAX_ARROW_SIZE) : reach;

  // `xf.translate_local` moves the origin along the rotated x axis (`:60`).
  const angle = Math.atan2(length, 0);
  const headOrigin = transform2DBasisXform(rotation(angle), { x: hasLine ? reach - headSize : 0, y: 0 });
  const toWorld = rotation(angle, headOrigin);
  const head: ShapeCommand = {
    kind: 'fill',
    points: [
      { x: headSize, y: 0 },
      { x: 0, y: 0.5 * headSize },
      { x: 0, y: -0.5 * headSize },
    ].map((p) => transform2DXform(toWorld, p)),
    role: 'shape',
  };
  if (!hasLine) return [head];
  return [line({ x: 0, y: 0 }, { x: 0, y: Math.sign(length) * (reach - headSize) }, RAY_LINE_WIDTH), head];
}
