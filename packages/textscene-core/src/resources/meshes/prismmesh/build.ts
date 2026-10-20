/**
 * PrismMesh geometry, ported from Godot `PrismMesh::_create_mesh_array`
 * (`primitive_meshes.cpp:1610-1873`): a triangle in the XY plane, apex at the top,
 * extruded along Z. It reverses each index triple and flips V, the two
 * conversions `godotSurface.ts` applies to baked Godot geometry.
 *
 * Derived from Godot Engine (`scene/resources/3d/primitive_meshes.cpp`), used under the MIT licence:
 *
 *   Copyright (c) 2014-present Godot Engine contributors (see AUTHORS.md).
 *   Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 *
 *   Permission is hereby granted, free of charge, to any person obtaining
 *   a copy of this software and associated documentation files (the
 *   "Software"), to deal in the Software without restriction, including
 *   without limitation the rights to use, copy, modify, merge, publish,
 *   distribute, sublicense, and/or sell copies of the Software, and to
 *   permit persons to whom the Software is furnished to do so, subject to
 *   the following conditions:
 *
 *   The above copyright notice and this permission notice shall be
 *   included in all copies or substantial portions of the Software.
 *
 *   THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 *   EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
 *   MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
 *   IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
 *   CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
 *   TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
 *   SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

import * as THREE from 'three';
import type { PrismMeshProperties } from './types.js';
import { normalizedVector3 } from '../../../godot/math/vector.js';

const ONE_THIRD = 1 / 3;
const TWO_THIRDS = 2 / 3;

export function buildPrismMeshGeometry(p: PrismMeshProperties): THREE.BufferGeometry {
  const { size, leftToRight } = p;
  const subdivideW = p.subdivideWidth;
  const subdivideH = p.subdivideHeight;
  const subdivideD = p.subdivideDepth;

  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  let point = 0;

  const start = { x: size.x * -0.5, y: size.y * -0.5, z: size.z * -0.5 };

  const vertex = (
    position: readonly [number, number, number],
    normal: readonly [number, number, number],
    u: number,
    v: number
  ): void => {
    positions.push(position[0], position[1], position[2]);
    normals.push(normal[0], normal[1], normal[2]);
    // Godot's UV origin is the image's top left.
    uvs.push(u, 1 - v);
    point++;
  };
  /** Godot's clockwise-front triple, emitted counter-clockwise for three. */
  const triangle = (a: number, b: number, c: number): void => {
    indices.push(a, c, b);
  };

  /* front + back: the triangular caps (`:1663`), apex X by `left_to_right` (`:1670`) */
  let y = start.y;
  let thisrow = point;
  let prevrow = 0;
  for (let j = 0; j <= subdivideH + 1; j++) {
    const scale = j / (subdivideH + 1);
    const scaledSizeX = size.x * scale;
    const startX = start.x + (1 - scale) * size.x * leftToRight;
    const offsetFront = (1 - scale) * ONE_THIRD * leftToRight;
    const offsetBack = (1 - scale) * ONE_THIRD * (1 - leftToRight);
    const v = j / (2 * (subdivideH + 1));

    let x = 0;
    for (let i = 0; i <= subdivideW + 1; i++) {
      const u = (i / (3 * (subdivideW + 1))) * scale;

      // The double negative on Z is Godot's own (`:1687`).
      vertex([startX + x, -y, -start.z], [0, 0, 1], offsetFront + u, v);
      vertex([startX + scaledSizeX - x, -y, start.z], [0, 0, -1], TWO_THIRDS + offsetBack + u, v);

      const i2 = i * 2;
      if (i > 0 && j === 1) {
        // The row below is the collapsed apex, so each quad is one triangle, the
        // fan Godot emits at `j == 1` (`:1706`).
        triangle(prevrow + i2, thisrow + i2, thisrow + i2 - 2);
        triangle(prevrow + i2 + 1, thisrow + i2 + 1, thisrow + i2 - 1);
      } else if (i > 0 && j > 0) {
        triangle(prevrow + i2 - 2, prevrow + i2, thisrow + i2 - 2);
        triangle(prevrow + i2, thisrow + i2, thisrow + i2 - 2);
        triangle(prevrow + i2 - 1, prevrow + i2 + 1, thisrow + i2 - 1);
        triangle(prevrow + i2 + 1, thisrow + i2 + 1, thisrow + i2 - 1);
      }

      x += (scale * size.x) / (subdivideW + 1);
    }

    y += size.y / (subdivideH + 1);
    prevrow = thisrow;
    thisrow = point;
  }

  /* left + right: the slanted sides, whose normals tilt with `left_to_right` (`:1746-1752`) */
  const normalLeft = normalizedVector3(-size.y, size.x * leftToRight, 0);
  const normalRight = normalizedVector3(size.y, size.x * (1 - leftToRight), 0);

  y = start.y;
  thisrow = point;
  prevrow = 0;
  for (let j = 0; j <= subdivideH + 1; j++) {
    const scale = j / (subdivideH + 1);
    const left = start.x + size.x * (1 - scale) * leftToRight;
    const right = left + size.x * scale;
    const v = j / (2 * (subdivideH + 1));

    let z = start.z;
    for (let i = 0; i <= subdivideD + 1; i++) {
      const u = i / (3 * (subdivideD + 1));

      vertex([right, -y, -z], normalRight, ONE_THIRD + u, v);
      vertex([left, -y, z], normalLeft, u, 0.5 + v);

      if (i > 0 && j > 0) {
        const i2 = i * 2;
        triangle(prevrow + i2 - 2, prevrow + i2, thisrow + i2 - 2);
        triangle(prevrow + i2, thisrow + i2, thisrow + i2 - 2);
        triangle(prevrow + i2 - 1, prevrow + i2 + 1, thisrow + i2 - 1);
        triangle(prevrow + i2 + 1, thisrow + i2 + 1, thisrow + i2 - 1);
      }

      z += size.z / (subdivideD + 1);
    }

    y += size.y / (subdivideH + 1);
    prevrow = thisrow;
    thisrow = point;
  }

  /* bottom: the rectangular base (`:1822`) */
  let z = start.z;
  thisrow = point;
  prevrow = 0;
  for (let j = 0; j <= subdivideD + 1; j++) {
    const v = j / (2 * (subdivideD + 1));

    let x = start.x;
    for (let i = 0; i <= subdivideW + 1; i++) {
      const u = i / (3 * (subdivideW + 1));

      vertex([x, start.y, -z], [0, -1, 0], TWO_THIRDS + u, 0.5 + v);

      if (i > 0 && j > 0) {
        triangle(prevrow + i - 1, prevrow + i, thisrow + i - 1);
        triangle(prevrow + i, thisrow + i, thisrow + i - 1);
      }

      x += size.x / (subdivideW + 1);
    }

    z += size.z / (subdivideD + 1);
    prevrow = thisrow;
    thisrow = point;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(
    point > 65535 ? new THREE.Uint32BufferAttribute(indices, 1) : new THREE.Uint16BufferAttribute(indices, 1)
  );
  return geometry;
}
