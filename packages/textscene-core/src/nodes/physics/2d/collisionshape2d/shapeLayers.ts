/**
 * The layers of a shape gizmo in draw order: a mesh of vertex colours for each run of fills and
 * strokes, and a line for each hairline. Colours are the linear
 * `THREE.Color` of the Godot sRGB role colour, with its alpha kept apart.
 */

import * as THREE from 'three';
import { triangulatePolygon } from '../../../../godot/math/triangulate';
import type { Rgba } from '../../../../godot/math/math';
import type { Vector2 } from '../../../../godot/math/vector';
import { godotColorToLinear } from '../../../../r3f/godotColor';
import { godotPolylineToSegments } from '../../../../r3f/gizmo/godotPolylineToSegments';
import type { GeometryBuffers } from '../../../2d/ui/graphedit/connectionStroke';
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

/** A layer before its meshes merge: the buffers of a mesh, not yet a geometry. */
const FLOATS_PER_COLOUR = 4;

type Piece = { kind: 'mesh'; buffers: GeometryBuffers } | Extract<ShapeLayer, { kind: 'hairline' }>;

/** The role's colour with its channels linear and its alpha as it is. */
function linearRole(role: ColourRole, colour: Rgba): Rgba {
  const { a, ...channels } = roleColour(role, colour);
  const { r, g, b } = godotColorToLinear(channels);
  return { r, g, b, a };
}

function meshOf(positions: number[], colors: number[], indices: number[]): Piece {
  return { kind: 'mesh', buffers: { positions, colors, indices } };
}

/** Null when the polygon does not triangulate: Godot draws nothing then (`renderer_canvas_cull.cpp:1727`). */
function fillLayer(points: readonly Vector2[], role: ColourRole, colour: Rgba): Piece | null {
  const indices = triangulatePolygon(points);
  if (indices.length === 0) return null;
  const { r, g, b, a } = linearRole(role, colour);
  return meshOf(
    points.flatMap(({ x, y }) => [x, -y, 0]),
    points.flatMap(() => [r, g, b, a]),
    indices
  );
}

function hairlineLayer(points: readonly Vector2[], role: ColourRole, colour: Rgba): Piece | null {
  const positions = godotPolylineToSegments(
    points.flatMap(({ x, y }) => [x, y]),
    false
  );
  if (!positions) return null;
  const { a, ...linear } = linearRole(role, colour);
  return {
    kind: 'hairline',
    positions,
    colour: new THREE.Color().setRGB(linear.r, linear.g, linear.b),
    alpha: a,
  };
}

function strokeLayer(
  points: readonly Vector2[],
  width: number,
  roles: readonly ColourRole[],
  colour: Rgba
): Piece | null {
  const stroke = polylineStrokeGeometry(
    points,
    roles.map((role) => linearRole(role, colour)),
    width,
    false
  );
  if (stroke.indices.length === 0) return null;
  return { kind: 'mesh', buffers: stroke };
}

function pieceOf(command: ShapeCommand, colour: Rgba): Piece | null {
  switch (command.kind) {
    case 'fill':
      return fillLayer(command.points, command.role, colour);
    case 'hairline':
      return hairlineLayer(command.points, command.role, colour);
    case 'stroke':
      return strokeLayer(command.points, command.width, command.roles, colour);
  }
}

/**
 * One mesh for a run of meshes. They blend triangle by triangle in index order, so the one draw
 * looks as the several did, and a concave polygon of a thousand segments stays one layer.
 */
function mergedLayers(pieces: readonly Piece[]): ShapeLayer[] {
  const layers: ShapeLayer[] = [];
  let run: GeometryBuffers = { positions: [], colors: [], indices: [] };
  const flush = () => {
    if (run.indices.length === 0) return;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(run.positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(run.colors, FLOATS_PER_COLOUR));
    geometry.setIndex(run.indices);
    layers.push({ kind: 'mesh', geometry });
    run = { positions: [], colors: [], indices: [] };
  };
  for (const piece of pieces) {
    if (piece.kind === 'hairline') {
      flush();
      layers.push(piece);
      continue;
    }
    const firstVertex = run.positions.length / 3;
    run.positions.push(...piece.buffers.positions);
    run.colors.push(...piece.buffers.colors);
    for (const index of piece.buffers.indices) run.indices.push(firstVertex + index);
  }
  flush();
  return layers;
}

/** The layers of `drawing` in the sRGB `colour` the node draws it in. */
export function shapeLayers(drawing: ShapeDrawing, colour: Rgba): ShapeLayer[] {
  return mergedLayers(drawing.flatMap((command) => pieceOf(command, colour) ?? []));
}
