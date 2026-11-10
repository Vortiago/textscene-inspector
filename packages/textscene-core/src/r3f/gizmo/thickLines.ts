/**
 * The triangles of Godot's `draw_line` with a width: each line is a quad, its two long sides the
 * line pushed half the width to either side, with butt ends (`renderer_canvas_cull.cpp:734-753`).
 */

import * as THREE from 'three';
import {
  FLOATS_PER_VERTEX,
  normalizedVector2,
  vector2Orthogonal,
  vector2Sub,
  type Vector2,
} from '../../godot/math/vector';
import { writeGodotPointAsThree } from '../node2dTransform';

export interface Line2 {
  from: Vector2;
  to: Vector2;
}

const CORNERS_PER_QUAD = 4;
const QUAD_TRIANGLES = [0, 1, 2, 0, 2, 3];

/** Null for no lines. A line of no length has no normal, so its quad collapses and draws nothing. */
export function thickLinesGeometry(lines: readonly Line2[], width: number): THREE.BufferGeometry | null {
  if (lines.length === 0) return null;
  const positions = new Float32Array(lines.length * CORNERS_PER_QUAD * FLOATS_PER_VERTEX);
  const indices: number[] = [];
  lines.forEach(({ from, to }, index) => {
    const normal = normalizedVector2(vector2Orthogonal(vector2Sub(from, to)));
    const half = { x: (normal.x * width) / 2, y: (normal.y * width) / 2 };
    const corners = [
      { x: from.x + half.x, y: from.y + half.y },
      { x: from.x - half.x, y: from.y - half.y },
      { x: to.x - half.x, y: to.y - half.y },
      { x: to.x + half.x, y: to.y + half.y },
    ];
    const first = index * CORNERS_PER_QUAD;
    corners.forEach(({ x, y }, corner) =>
      writeGodotPointAsThree(positions, (first + corner) * FLOATS_PER_VERTEX, x, y)
    );
    indices.push(...QUAD_TRIANGLES.map((corner) => first + corner));
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, FLOATS_PER_VERTEX));
  geometry.setIndex(indices);
  return geometry;
}
