/**
 * CSGPolygon3D geometry, pinned against `CSGPolygon3D::_build_brush`
 * (`modules/csg/csg_shape.cpp:2151`). The obvious three.js substitutes look solid but are wrong:
 * `ExtrudeGeometry` sweeps to +Z over [0, depth] where Godot sweeps to -Z over [-depth, 0], and
 * `LatheGeometry` starts its profile on +Z where Godot starts on +X and never emits caps.
 */

import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { tessellateCurve3D, type Curve3DControlPoint } from '../../../../resources/shapes/curve3d';
import { buildCsgPolygonGeometry, PathRotation, PolygonMode, type CsgPolygonSpec } from './polygonGeometry';

const BASE: CsgPolygonSpec = {
  polygon: new Float32Array([0, 0, 0, 1, 1, 1, 1, 0]),
  mode: PolygonMode.DEPTH,
  depth: 1,
  spinDegrees: 360,
  spinSides: 8,
  smoothFaces: false,
  flipFaces: false,
  pathIntervalType: 0,
  pathInterval: 1,
  pathSimplifyAngle: 0,
  pathRotation: PathRotation.PATH_FOLLOW,
  pathRotationAccurate: false,
  pathContinuousU: true,
  pathUDistance: 1,
  pathJoined: false,
  path: null,
};

function build(overrides: Partial<CsgPolygonSpec> = {}) {
  return buildCsgPolygonGeometry({ ...BASE, ...overrides });
}

function box(geometry: THREE.BufferGeometry): THREE.Box3 {
  geometry.computeBoundingBox();
  return geometry.boundingBox!;
}

const triangleCount = (g: THREE.BufferGeometry) => g.getAttribute('position').count / 3;

/** The Slope witness, csg.tscn:145. */
const SLOPE = new Float32Array([0, -1, 0, 0, 2, -1]);
/** The Staircase witness, csg.tscn:154. Concave, so a fan triangulator gets it wrong. */
const STAIRCASE = new Float32Array([
  0, -1, 0, 0, 0.5, 0, 0.5, -0.25, 1, -0.25, 1, -0.5, 1.5, -0.5, 1.5, -0.75, 2, -0.75, 2, -1,
]);

/** A straight curve of the given length running along -Z. */
function straightCurve(length: number): Curve3DControlPoint[] {
  const zero = { x: 0, y: 0, z: 0 };
  return [
    { in: zero, out: zero, position: { x: 0, y: 0, z: 0 } },
    { in: zero, out: zero, position: { x: 0, y: 0, z: -length } },
  ];
}

describe('buildCsgPolygonGeometry', () => {
  describe('MODE_DEPTH', () => {
    it('extrudes toward -Z over [-depth, 0], NOT +Z and NOT centred', () => {
      // csg_shape.cpp:2352 translate_local(0, 0, -depth) from identity. ExtrudeGeometry
      // would give [0, depth]; a "centred" reading would give [-depth/2, depth/2].
      const b = box(build({ polygon: SLOPE, depth: 2 }));
      expect(b.min.z).toBeCloseTo(-2, 6);
      expect(b.max.z).toBeCloseTo(0, 6);
    });

    it('keeps the polygon in XY with no axis flip', () => {
      const b = box(build({ polygon: SLOPE, depth: 2 }));
      expect(b.min.x).toBeCloseTo(0, 6);
      expect(b.max.x).toBeCloseTo(2, 6);
      expect(b.min.y).toBeCloseTo(-1, 6);
      expect(b.max.y).toBeCloseTo(0, 6);
    });

    it('emits both caps plus one wall ring', () => {
      // extrusions 1, end_count 2 → 1 * (sides*2) + 2 * shapeFaceCount.
      // The Slope is a triangle: 3 sides, 1 cap triangle.
      expect(triangleCount(build({ polygon: SLOPE }))).toBe(1 * 3 * 2 + 2 * 1);
    });

    it('triangulates a concave outline correctly', () => {
      // The Staircase has 10 vertices and is concave; a convex fan would emit 8 cap
      // triangles but place them outside the outline.
      const geometry = build({ polygon: STAIRCASE, depth: 2 });
      expect(triangleCount(geometry)).toBe(1 * 10 * 2 + 2 * 8);
      const b = box(geometry);
      expect(b.max.x).toBeCloseTo(2, 6);
      expect(b.min.y).toBeCloseTo(-1, 6);
    });
  });

  describe('MODE_SPIN', () => {
    it('revolves about +Y, sweeping +X toward -Z', () => {
      // Godot's Transform3D::rotate left-multiplies, a global rotation about +Y, so at
      // +90 degrees the profile's +X has swept to -Z.
      const b = box(build({ polygon: STAIRCASE, mode: PolygonMode.SPIN, spinDegrees: 90, spinSides: 32 }));
      expect(b.max.x).toBeCloseTo(2, 2);
      expect(b.min.z).toBeCloseTo(-2, 2);
      expect(b.max.z).toBeCloseTo(0, 2);
    });

    it('builds BOTH end caps when the spin is partial', () => {
      const sides = 8;
      const geometry = build({ polygon: SLOPE, mode: PolygonMode.SPIN, spinDegrees: 90, spinSides: sides });
      expect(triangleCount(geometry)).toBe(sides * 3 * 2 + 2 * 1);
    });

    it('builds NO caps at a full revolution, closing on itself instead', () => {
      // csg_shape.cpp:2214: end_count stays 0 at 360 degrees, and the last frame snaps
      // back to the base transform so the seam shares vertices exactly.
      const sides = 8;
      const geometry = build({ polygon: SLOPE, mode: PolygonMode.SPIN, spinDegrees: 360, spinSides: sides });
      expect(triangleCount(geometry)).toBe(sides * 3 * 2);
    });
  });

  describe('MODE_PATH', () => {
    const plan = (length: number, pointCount = 2) => ({
      sampler: tessellateCurve3D(straightCurve(length)),
      baseMatrix: null,
      pointCount,
    });

    it('renders nothing when path_node did not resolve', () => {
      expect(triangleCount(build({ mode: PolygonMode.PATH, path: null }))).toBe(0);
    });

    it('sweeps the full curve length', () => {
      const geometry = build({
        mode: PolygonMode.PATH,
        pathRotation: PathRotation.POLYGON,
        pathInterval: 1,
        path: plan(4),
      });
      expect(box(geometry).min.z).toBeCloseTo(-4, 3);
    });

    it('drops the caps when path_joined is on', () => {
      const open = build({ mode: PolygonMode.PATH, pathRotation: PathRotation.POLYGON, pathInterval: 1, path: plan(4) });
      const joined = build({
        mode: PolygonMode.PATH,
        pathRotation: PathRotation.POLYGON,
        pathInterval: 1,
        pathJoined: true,
        path: plan(4),
      });
      // Joined keeps the extrusion it would otherwise trade for two caps.
      expect(triangleCount(joined)).toBeGreaterThan(triangleCount(open) - 2 * 2);
      expect(triangleCount(open) % 2).toBe(0);
    });

    it('collapses collinear frames when path_simplify_angle is set', () => {
      const detailed = build({ mode: PolygonMode.PATH, pathRotation: PathRotation.POLYGON, pathInterval: 0.25, path: plan(4) });
      const simplified = build({
        mode: PolygonMode.PATH,
        pathRotation: PathRotation.POLYGON,
        pathInterval: 0.25,
        pathSimplifyAngle: 4,
        path: plan(4),
      });
      // A straight curve is entirely collinear, so nearly every frame is redundant.
      expect(triangleCount(simplified)).toBeLessThan(triangleCount(detailed));
      expect(box(simplified).min.z).toBeCloseTo(-4, 3);
    });
  });

  describe('smooth_faces', () => {
    it('smooths the WALLS but never the caps (csg_shape.cpp:2334, :2489)', () => {
      const geometry = build({ polygon: STAIRCASE, depth: 2, smoothFaces: true });
      const n = geometry.getAttribute('normal');
      const flatTriangle = (t: number) => {
        const a = new THREE.Vector3(n.getX(t * 3), n.getY(t * 3), n.getZ(t * 3));
        const b = new THREE.Vector3(n.getX(t * 3 + 1), n.getY(t * 3 + 1), n.getZ(t * 3 + 1));
        const c = new THREE.Vector3(n.getX(t * 3 + 2), n.getY(t * 3 + 2), n.getZ(t * 3 + 2));
        return a.distanceTo(b) < 1e-6 && b.distanceTo(c) < 1e-6;
      };
      // Front cap triangles come first and must stay flat even with smooth_faces on.
      expect(flatTriangle(0)).toBe(true);
      // At least one wall triangle must not be flat.
      const wallStart = 8;
      const anySmooth = Array.from({ length: 20 }, (_, i) => wallStart + i).some((t) => !flatTriangle(t));
      expect(anySmooth).toBe(true);
    });

    it('leaves every triangle flat when smooth_faces is off', () => {
      const geometry = build({ polygon: STAIRCASE, depth: 2, smoothFaces: false });
      const n = geometry.getAttribute('normal');
      for (let t = 0; t < triangleCount(geometry); t++) {
        const a = new THREE.Vector3(n.getX(t * 3), n.getY(t * 3), n.getZ(t * 3));
        const b = new THREE.Vector3(n.getX(t * 3 + 1), n.getY(t * 3 + 1), n.getZ(t * 3 + 1));
        expect(a.distanceTo(b)).toBeLessThan(1e-6);
      }
    });
  });

  describe('degenerate input', () => {
    it('produces empty geometry for fewer than 3 vertices', () => {
      expect(triangleCount(build({ polygon: new Float32Array([0, 0, 1, 1]) }))).toBe(0);
    });

    it('produces empty geometry for an empty polygon', () => {
      expect(triangleCount(build({ polygon: new Float32Array([]) }))).toBe(0);
    });

    it('normalises winding, so a CCW outline builds the same solid as a CW one', () => {
      // Godot reverses when the signed area is positive, so authoring order cannot
      // change the shape.
      const cw = build({ polygon: SLOPE, depth: 2 });
      const ccw = build({ polygon: new Float32Array([2, -1, 0, 0, 0, -1]), depth: 2 });
      expect(triangleCount(ccw)).toBe(triangleCount(cw));
      expect(box(ccw).max.x).toBeCloseTo(box(cw).max.x, 6);
    });
  });
});
