/**
 * CSGPolygon3D geometry: a 2D outline swept into a solid by Godot's own frame-walking loop,
 * which its three modes share. Three's `ExtrudeGeometry` extrudes to +Z where Godot extrudes to
 * -Z, and `LatheGeometry` starts on +Z with no end caps. `polygonSweepSpec` says what to build,
 * `extrusionCounts` how far to walk and `polygonSweepFrames` holds the pieces.
 *
 * Derived from Godot Engine (`modules/csg/csg_shape.cpp`, `CSGPolygon3D::_build_brush`),
 * used under the MIT licence:
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
 *
 * See THIRD-PARTY-NOTICES.md.
 */

import * as THREE from 'three';
import { applyCsgNormals } from '../smoothNormals';
import { extrusionCounts } from './extrusionCounts';
import {
  emptyGeometry,
  facingMatrix,
  PATH_UP,
  signedArea,
  toPoints,
  warnOnce,
} from './polygonSweepFrames';
import {
  MIN_POLYGON_VERTICES,
  PathRotation,
  PolygonMode,
  type CsgPolygonSpec,
} from './polygonSweepSpec';
import { sweepFaceBuffer } from './sweepFaceBuffer';

export {
  MAX_PATH_EXTRUSIONS,
  PathIntervalType,
  PathRotation,
  PolygonMode,
} from './polygonSweepSpec';
export type { CsgPolygonPathPlan, CsgPolygonSpec } from './polygonSweepSpec';

export function buildCsgPolygonGeometry(spec: CsgPolygonSpec): THREE.BufferGeometry {
  const shape = toPoints(spec.polygon);
  if (shape.length < MIN_POLYGON_VERTICES) return emptyGeometry();

  // Godot normalises to clockwise before triangulating.
  if (signedArea(shape) > 0) shape.reverse();
  const shapeSides = shape.length;

  // A swept profile is routinely concave, and `fanTriangulate` is convex-only. Polygon2D's
  // `polygonRings` works in +Y-down pixel space, with hole and invert handling CSGPolygon3D lacks.
  const triangles = THREE.ShapeUtils.triangulateShape(shape, []);
  if (triangles.length < 1) {
    warnOnce(
      'csgpolygon-triangulate',
      '[CSGPolygon3D] Failed to triangulate polygon — check for self-intersecting edges.'
    );
    return emptyGeometry();
  }
  const shapeFaces = triangles.flat();
  const shapeFaceCount = triangles.length;

  // Bounding rect drives the cap UVs.
  const rect = new THREE.Box2().setFromPoints(shape);
  const rectSize = new THREE.Vector2().subVectors(rect.max, rect.min);

  const { mode, path } = spec;
  if (mode === PolygonMode.PATH && !path) return emptyGeometry();

  const curveLength = path ? path.sampler.length : 1;
  const counts = extrusionCounts(spec, curveLength);
  if (!counts) return emptyGeometry();
  const { extrusions, endCount } = counts;

  const extrusionFaceCount = shapeSides * 2;
  const maxFaces = extrusions * extrusionFaceCount + endCount * shapeFaceCount;

  const faces = sweepFaceBuffer(maxFaces);

  // --- Steps (csg_shape.cpp:2256-2273) ---
  let uStep = 1 / extrusions;
  if (spec.pathUDistance > 0) uStep *= curveLength / spec.pathUDistance;
  const vStep = 1 / shapeSides;
  const spinStep = THREE.MathUtils.degToRad(spec.spinDegrees / spec.spinSides);
  let extrusionStep = 1 / extrusions;
  if (mode === PolygonMode.PATH) {
    if (spec.pathJoined) extrusionStep = 1 / (extrusions - 1);
    extrusionStep *= curveLength;
  }

  const baseXform = path?.baseMatrix ? path.baseMatrix.clone() : new THREE.Matrix4();
  let currentXform = new THREE.Matrix4();
  let previousXform = new THREE.Matrix4();
  // Rewritten at the top of every extrusion step, before anything reads it.
  let previousPreviousXform: THREE.Matrix4;

  const sampleAt = (d: number): THREE.Vector3 => {
    const s = path!.sampler.sampleAt(d);
    return new THREE.Vector3(s.x, s.y, s.z);
  };

  /** Every PATH frame is `base · translate(point) · looking_at(direction, +Y)`. */
  const pathFrame = (point: THREE.Vector3, direction: THREE.Vector3): THREE.Matrix4 =>
    baseXform
      .clone()
      .multiply(new THREE.Matrix4().makeTranslation(point.x, point.y, point.z))
      .multiply(facingMatrix(direction, PATH_UP));

  if (mode === PolygonMode.PATH) {
    const point = sampleAt(0);
    let direction: THREE.Vector3;
    if (spec.pathRotation === PathRotation.POLYGON) {
      direction = new THREE.Vector3(0, 0, -1);
    } else {
      const next = sampleAt(extrusionStep);
      direction = spec.pathJoined ? next.clone().sub(sampleAt(curveLength)) : next.clone().sub(point);
    }
    currentXform = pathFrame(point, direction);
  }

  const capUv = (p: THREE.Vector2, back: boolean): THREE.Vector2 => {
    const x = rectSize.x !== 0 ? (p.x - rect.min.x) / rectSize.x : 0;
    const y = rectSize.y !== 0 ? (p.y - rect.min.y) / rectSize.y : 0;
    // Both caps live in the bottom half of a y-inverted texture; the back cap uses the
    // x-mirrored right side so the two do not overlap.
    return new THREE.Vector2(back ? 1 - x / 2 : x / 2, 1 - y / 2);
  };

  const shapeVertex = (i: number, m: THREE.Matrix4): THREE.Vector3 =>
    new THREE.Vector3(shape[i]!.x, shape[i]!.y, 0).applyMatrix4(m);

  /**
   * A flat end cap on the frame `m`. The front cap's triangles are REVERSED so both caps
   * face out of the sweep, and each half occupies its own side of the texture.
   */
  const emitCap = (m: THREE.Matrix4, back: boolean): void => {
    for (let f = 0; f < shapeFaceCount; f++) {
      const idx = [0, 1, 2].map((k) => shapeFaces[f * 3 + (back ? k : 2 - k)]!);
      faces.putTri(
        idx.map((i) => shapeVertex(i, m)) as [THREE.Vector3, THREE.Vector3, THREE.Vector3],
        idx.map((i) => capUv(shape[i]!, back)) as [THREE.Vector2, THREE.Vector2, THREE.Vector2],
        false
      );
    }
  };

  if (endCount > 0) emitCap(currentXform, false);

  // --- Extrusion walls ---
  const angleSimplifyDot = Math.cos(THREE.MathUtils.degToRad(spec.pathSimplifyAngle));
  let previousSimplifyDir = new THREE.Vector3();
  let facesCombined = 0;

  for (let x0 = 0; x0 < extrusions; x0++) {
    previousPreviousXform = previousXform;
    previousXform = currentXform;

    if (mode === PolygonMode.DEPTH) {
      // translate_local: origin += basis * v, so the sweep runs along LOCAL -Z.
      currentXform = currentXform
        .clone()
        .multiply(new THREE.Matrix4().makeTranslation(0, 0, -spec.depth));
    } else if (mode === PolygonMode.SPIN) {
      if (endCount === 0 && x0 === extrusions - 1) {
        // A full revolution snaps the last frame back onto the first so the surface
        // closes on the exact same vertices instead of merely meeting there.
        currentXform = baseXform.clone();
      } else {
        // Godot's Transform3D::rotate LEFT-multiplies: a global rotation about +Y.
        currentXform = new THREE.Matrix4()
          .makeRotationY(spinStep)
          .multiply(currentXform);
      }
    } else {
      const previousOffset = x0 * extrusionStep;
      let currentOffset = (x0 + 1) * extrusionStep;
      if (spec.pathJoined && x0 === extrusions - 1) currentOffset = 0;

      const previousPoint = sampleAt(previousOffset);
      const currentPoint = sampleAt(currentOffset);
      const extrusionDir = currentPoint.clone().sub(previousPoint).normalize();

      // Near-collinear frames are dropped by rewinding the write head over the faces
      // just emitted, which is exactly how Godot's `face -= extrusion_face_count` works.
      if (spec.pathSimplifyAngle > 0 && x0 > 0 && previousSimplifyDir.dot(extrusionDir) > angleSimplifyDot) {
        facesCombined += 1;
        previousXform = previousPreviousXform;
        faces.rewind(extrusionFaceCount);
      } else {
        facesCombined = 0;
        previousSimplifyDir = extrusionDir;
      }

      let direction: THREE.Vector3;
      if (spec.pathRotation === PathRotation.POLYGON) {
        direction = new THREE.Vector3(0, 0, -1);
      } else {
        let nextOffset = (x0 + 2) * extrusionStep;
        if (x0 === extrusions - 1) nextOffset = spec.pathJoined ? extrusionStep : currentOffset;
        direction = sampleAt(nextOffset).sub(previousPoint);
      }
      currentXform = pathFrame(currentPoint, direction);
    }

    let u0 = (x0 - facesCombined) * uStep;
    let u1 = (x0 + 1) * uStep;
    if (mode === PolygonMode.PATH && !spec.pathContinuousU) {
      u0 = 0;
      u1 = 1;
    }

    for (let y0 = 0; y0 < shapeSides; y0++) {
      const y1 = (y0 + 1) % shapeSides;
      // Walls occupy the TOP half of the texture; the caps have the bottom.
      const v0 = (y0 * vStep) / 2;
      const v1 = ((y0 + 1) * vStep) / 2;

      const q = [
        shapeVertex(y0, previousXform),
        shapeVertex(y0, currentXform),
        shapeVertex(y1, currentXform),
        shapeVertex(y1, previousXform),
      ];
      const qu = [
        new THREE.Vector2(u0, v0),
        new THREE.Vector2(u1, v0),
        new THREE.Vector2(u1, v1),
        new THREE.Vector2(u0, v1),
      ];

      faces.putTri([q[0]!, q[1]!, q[2]!], [qu[0]!, qu[1]!, qu[2]!], spec.smoothFaces);
      faces.putTri([q[2]!, q[3]!, q[0]!], [qu[2]!, qu[3]!, qu[0]!], spec.smoothFaces);
    }
  }

  if (endCount > 1) emitCap(currentXform, true);

  return applyCsgNormals(faces.finish(spec.flipFaces));
}
