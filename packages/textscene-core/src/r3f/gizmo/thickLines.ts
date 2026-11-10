/**
 * The triangles of Godot's `draw_line` with a width: each line is a butt-ended quad
 * (`renderer_canvas_cull.cpp:734-753`), the strip `buildLineStroke` builds for a two-point Line2D.
 */

import * as THREE from 'three';
import { FLOATS_PER_VERTEX, type Vector2 } from '../../godot/math/vector';
import { LineCapMode, LineJointMode, LineTextureMode } from '../../godot/scene/line2d';
import { buildLineStroke } from '../../nodes/2d/line2d/lineBuilder';
import { writeGodotPointAsThree } from '../node2dTransform';

export interface Line2 {
  from: Vector2;
  to: Vector2;
}

/** A line of no length gives a quad of no area. */
function quadOf({ from, to }: Line2, width: number) {
  return buildLineStroke({
    points: new Float32Array([from.x, from.y, to.x, to.y]),
    width,
    closed: false,
    jointMode: LineJointMode.SHARP,
    sharpLimit: 2,
    roundPrecision: 8,
    beginCapMode: LineCapMode.NONE,
    endCapMode: LineCapMode.NONE,
    textureMode: LineTextureMode.NONE,
    gradient: null,
    widthFactorAt: null,
    tileAspect: 1,
  });
}

/** Null for no lines. */
export function thickLinesGeometry(lines: readonly Line2[], width: number): THREE.BufferGeometry | null {
  const strokes = lines.map((line) => quadOf(line, width)).filter((stroke) => stroke !== null);
  if (strokes.length === 0) return null;
  const vertexCount = strokes.reduce((sum, { vertices }) => sum + vertices.length / 2, 0);
  const positions = new Float32Array(vertexCount * FLOATS_PER_VERTEX);
  const indices = new Uint32Array(strokes.reduce((sum, { indices }) => sum + indices.length, 0));
  let vertexAt = 0;
  let indexAt = 0;
  for (const { vertices, indices: strokeIndices } of strokes) {
    for (let i = 0; i < vertices.length; i += 2) {
      writeGodotPointAsThree(
        positions,
        (vertexAt + i / 2) * FLOATS_PER_VERTEX,
        vertices[i]!,
        vertices[i + 1]!
      );
    }
    for (const index of strokeIndices) indices[indexAt++] = vertexAt + index;
    vertexAt += vertices.length / 2;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, FLOATS_PER_VERTEX));
  geometry.setIndex(new THREE.BufferAttribute(indices, 1));
  return geometry;
}
