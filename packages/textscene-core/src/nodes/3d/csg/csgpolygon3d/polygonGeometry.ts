/**
 * CSGPolygon3D geometry: a 2D outline swept into a solid, three ways.
 *
 * Nothing three ships builds this shape. `ExtrudeGeometry` extrudes to +Z over `[0, depth]`
 * where Godot extrudes to -Z over `[-depth, 0]`, and `LatheGeometry` starts its profile on
 * +Z where Godot starts on +X and emits no end caps at all. So the sweep is Godot's own,
 * and the three modes share one frame-walking loop exactly as they do in the engine.
 *
 * `polygonRings` from the Polygon2D slice is NOT reusable here: it works in Godot's
 * +Y-down pixel space and carries hole/invert machinery CSGPolygon3D has no concept of.
 * `fanTriangulate` is not usable either, being convex-only, while the corpus outlines
 * (the Staircase, the 45-vertex Road profile) are concave.
 *
 * ---------------------------------------------------------------------------
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
 * ---------------------------------------------------------------------------
 */

import * as THREE from 'three';
import { warn } from '../../../../logger';
import type { Curve3DSampler } from '../../../../resources/shapes/curve3d';
import { applyCsgNormals, type CsgFaceSoup } from '../smoothNormals';

/**
 * The builder runs on every geometry rebuild, so an unconditional `warn` for an
 * approximation would repeat per keystroke in the source pane and bury real problems.
 * Module-level rather than per-call because "once" has to outlive a single build.
 */
const warned = new Set<string>();
function warnOnce(key: string, message: string): void {
  if (warned.has(key)) return;
  warned.add(key);
  warn(message);
}

/** Godot `CSGPolygon3D.Mode`. */
export const PolygonMode = { DEPTH: 0, SPIN: 1, PATH: 2 } as const;
/** Godot `CSGPolygon3D.PathRotation`. */
export const PathRotation = { POLYGON: 0, PATH: 1, PATH_FOLLOW: 2 } as const;
/** Godot `CSGPolygon3D.PathIntervalType`. */
export const PathIntervalType = { DISTANCE: 0, SUBDIVIDE: 1 } as const;

/**
 * Everything MODE_PATH needs that lives outside this node, resolved beforehand by the
 * `path_node` pass because a component cannot see its siblings.
 */
export interface CsgPolygonPathPlan {
  sampler: Curve3DSampler;
  /** The Path3D's global transform, or null when `path_local` is on (identity). */
  baseMatrix: THREE.Matrix4 | null;
  /** `Curve3D.point_count`, which PATH_INTERVAL_SUBDIVIDE counts in. */
  pointCount: number;
}

export interface CsgPolygonSpec {
  /** Flat `[x0, y0, x1, y1, …]` in Godot's order. */
  polygon: Float32Array;
  mode: number;
  depth: number;
  spinDegrees: number;
  spinSides: number;
  smoothFaces: boolean;
  flipFaces: boolean;
  pathIntervalType: number;
  pathInterval: number;
  pathSimplifyAngle: number;
  pathRotation: number;
  pathRotationAccurate: boolean;
  pathContinuousU: boolean;
  pathUDistance: number;
  pathJoined: boolean;
  /** Null when mode is not PATH, or when `path_node` did not resolve. */
  path: CsgPolygonPathPlan | null;
}

/**
 * A previewer must not hang a tab. Godot has no such cap, but `racetrack_csg.tscn` at
 * `path_interval = 0.5` over its full curve already asks for well over a thousand frames,
 * so a runaway interval is a real shape rather than a hypothetical one.
 */
const MAX_PATH_EXTRUSIONS = 4096;

const MIN_POLYGON_VERTICES = 3;

function emptyGeometry(): THREE.BufferGeometry {
  return applyCsgNormals({ positions: new Float32Array(0), uvs: new Float32Array(0), smooth: [] });
}

/**
 * Signed area, matching Godot's `Triangulate::get_area`: the shoelace sum of
 * `p.cross(q)` halved, positive for counter-clockwise.
 */
function signedArea(points: THREE.Vector2[]): number {
  let a = 0;
  for (let p = points.length - 1, q = 0; q < points.length; p = q++) {
    a += points[p]!.x * points[q]!.y - points[p]!.y * points[q]!.x;
  }
  return a * 0.5;
}

function toPoints(flat: Float32Array): THREE.Vector2[] {
  const out: THREE.Vector2[] = [];
  for (let i = 0; i + 1 < flat.length; i += 2) out.push(new THREE.Vector2(flat[i]!, flat[i + 1]!));
  return out;
}

/** `Transform3D().looking_at(dir, up)`, which is three's `lookAt` with the same convention. */
/** Godot passes `Vector3(0, 1, 0)` as the up vector for every PATH frame. */
const PATH_UP = new THREE.Vector3(0, 1, 0);

function facingMatrix(dir: THREE.Vector3, up: THREE.Vector3): THREE.Matrix4 {
  const m = new THREE.Matrix4();
  // A zero or up-parallel direction makes the basis degenerate in Godot too; identity is
  // the least-surprising fallback and keeps NaN out of the vertex buffer.
  if (dir.lengthSq() === 0) return m;
  const safeUp = Math.abs(dir.clone().normalize().dot(up)) > 0.9999 ? new THREE.Vector3(0, 0, 1) : up;
  return m.lookAt(new THREE.Vector3(0, 0, 0), dir, safeUp);
}

export function buildCsgPolygonGeometry(spec: CsgPolygonSpec): THREE.BufferGeometry {
  const shape = toPoints(spec.polygon);
  if (shape.length < MIN_POLYGON_VERTICES) return emptyGeometry();

  // Godot normalises to clockwise before triangulating.
  if (signedArea(shape) > 0) shape.reverse();
  const shapeSides = shape.length;

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

  // --- Counts (csg_shape.cpp:2201-2231) ---
  const curveLength = path ? path.sampler.length : 1;
  let extrusions = 0;
  let endCount = 0;
  switch (mode) {
    case PolygonMode.DEPTH:
      extrusions = 1;
      endCount = 2;
      break;
    case PolygonMode.SPIN:
      extrusions = spec.spinSides;
      if (spec.spinDegrees < 360) endCount = 2;
      break;
    case PolygonMode.PATH: {
      extrusions =
        spec.pathIntervalType === PathIntervalType.DISTANCE
          ? Math.max(1, Math.ceil(curveLength / spec.pathInterval)) + 1
          : Math.ceil(path!.pointCount / spec.pathInterval);
      if (!spec.pathJoined) {
        endCount = 2;
        extrusions -= 1;
      }
      break;
    }
    default:
      return emptyGeometry();
  }

  if (!Number.isFinite(extrusions) || extrusions < 1) return emptyGeometry();
  if (extrusions > MAX_PATH_EXTRUSIONS) {
    warnOnce(
      'csgpolygon-extrusions',
      `[CSGPolygon3D] ${extrusions} extrusions exceeds the ${MAX_PATH_EXTRUSIONS} cap — ` +
        'clamping. Raise path_interval to sweep the whole curve.'
    );
    extrusions = MAX_PATH_EXTRUSIONS;
  }

  if (mode === PolygonMode.PATH) {
    if (spec.pathRotation === PathRotation.PATH_FOLLOW) {
      warnOnce(
        'csgpolygon-path-follow',
        '[CSGPolygon3D] path_rotation = PATH_FOLLOW renders as PATH: the curve’s baked ' +
          'up-vectors and per-point tilts are not reproduced, so a banking path differs.'
      );
    }
    if (spec.pathRotationAccurate) {
      warnOnce(
        'csgpolygon-rotation-accurate',
        '[CSGPolygon3D] path_rotation_accurate renders as false: sampling with rotation ' +
          'is not reproduced.'
      );
    }
  }

  const extrusionFaceCount = shapeSides * 2;
  const maxFaces = extrusions * extrusionFaceCount + endCount * shapeFaceCount;

  const positions = new Float32Array(maxFaces * 9);
  const uvs = new Float32Array(maxFaces * 6);
  const smooth: boolean[] = new Array(maxFaces).fill(false);
  let face = 0;

  const putTri = (
    p: [THREE.Vector3, THREE.Vector3, THREE.Vector3],
    u: [THREE.Vector2, THREE.Vector2, THREE.Vector2],
    isSmooth: boolean
  ): void => {
    for (let j = 0; j < 3; j++) {
      positions.set([p[j]!.x, p[j]!.y, p[j]!.z], face * 9 + j * 3);
      uvs.set([u[j]!.x, u[j]!.y], face * 6 + j * 2);
    }
    smooth[face] = isSmooth;
    face++;
  };

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
  let previousPreviousXform = new THREE.Matrix4();

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
      putTri(
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
        face -= extrusionFaceCount;
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

      putTri([q[0]!, q[1]!, q[2]!], [qu[0]!, qu[1]!, qu[2]!], spec.smoothFaces);
      putTri([q[2]!, q[3]!, q[0]!], [qu[2]!, qu[3]!, qu[0]!], spec.smoothFaces);
    }
  }

  if (endCount > 1) emitCap(currentXform, true);

  // `path_simplify_angle` rewinds `face`, so the tail of the buffer is unused.
  return applyCsgNormals({
    positions: positions.subarray(0, face * 9),
    uvs: uvs.subarray(0, face * 6),
    smooth: smooth.slice(0, face),
    invert: spec.flipFaces,
  } satisfies CsgFaceSoup);
}
