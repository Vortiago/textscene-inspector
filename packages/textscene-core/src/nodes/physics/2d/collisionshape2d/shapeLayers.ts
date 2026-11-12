/**
 * The layers of a shape gizmo, one for each command of a drawing and in its order: a mesh of
 * vertex colours for a fill or a stroke, and a line for a hairline. Colours are the linear
 * `THREE.Color` of the Godot sRGB role colour, with its alpha kept apart.
 */

import * as THREE from 'three';
import { triangulatePolygon } from '../../../../godot/math/triangulate';
import type { Rgba } from '../../../../godot/math/math';
import type { Vector2 } from '../../../../godot/math/vector';
import { godotColorToLinear } from '../../../../r3f/godotColor';
import { godotPolylineToSegments } from '../../../../r3f/gizmo/godotPolylineToSegments';
import { polylineStrokeGeometry } from '../../../2d/ui/graphedit/polylineStroke';
import {
  roleColour,
  type ColourRole,
  type ShapeCommand,
  type ShapeDrawing,
} from '../../../../resources/shapes/shape2d/drawing';

export type ShapeLayer =
  | { kind: 'mesh'; geometry: THREE.BufferGeometry }
  | { kind: 'hairline'; positions: Float32Array; colour: THREE.Color; alpha: number };

const FLOATS_PER_COLOUR = 4;

/** `[r, g, b, a]` of a Godot sRGB colour: the channels linear and the alpha as it is. */
function vertexColour(role: ColourRole, colour: Rgba): number[] {
  const { a, ...channels } = roleColour(role, colour);
  const linear = godotColorToLinear(channels);
  return [linear.r, linear.g, linear.b, a];
}

function meshOf(positions: number[], colours: number[], indices: number[]): ShapeLayer {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colours, FLOATS_PER_COLOUR));
  geometry.setIndex(indices);
  return { kind: 'mesh', geometry };
}

/** Null when the polygon does not triangulate: Godot draws nothing then (`renderer_canvas_cull.cpp:1727`). */
function fillLayer(points: readonly Vector2[], role: ColourRole, colour: Rgba): ShapeLayer | null {
  const indices = triangulatePolygon(points);
  if (indices.length === 0) return null;
  const paint = vertexColour(role, colour);
  return meshOf(
    points.flatMap(({ x, y }) => [x, -y, 0]),
    points.flatMap(() => paint),
    indices
  );
}

function hairlineLayer(points: readonly Vector2[], role: ColourRole, colour: Rgba): ShapeLayer | null {
  const positions = godotPolylineToSegments(
    points.flatMap(({ x, y }) => [x, y]),
    false
  );
  if (!positions) return null;
  const { a, ...channels } = roleColour(role, colour);
  return { kind: 'hairline', positions, colour: godotColorToLinear(channels), alpha: a };
}

function strokeLayer(
  points: readonly Vector2[],
  width: number,
  roles: readonly ColourRole[],
  colour: Rgba
): ShapeLayer | null {
  const paint = roles.map((role) => vertexColour(role, colour));
  const stroke = polylineStrokeGeometry(
    points,
    paint.map(([r, g, b, a]) => ({ r: r!, g: g!, b: b!, a: a! })),
    width,
    false
  );
  if (stroke.indices.length === 0) return null;
  return meshOf(stroke.positions, stroke.colors, stroke.indices);
}

function layerOf(command: ShapeCommand, colour: Rgba): ShapeLayer | null {
  switch (command.kind) {
    case 'fill':
      return fillLayer(command.points, command.role, colour);
    case 'hairline':
      return hairlineLayer(command.points, command.role, colour);
    case 'stroke':
      return strokeLayer(command.points, command.width, command.roles, colour);
  }
}

/** The layers of `drawing` in the sRGB `colour` the node draws it in. */
export function shapeLayers(drawing: ShapeDrawing, colour: Rgba): ShapeLayer[] {
  return drawing.flatMap((command) => layerOf(command, colour) ?? []);
}
