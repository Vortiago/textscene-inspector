/**
 * CSGCylinder3D geometry, pinned against `CSGCylinder3D::_build_brush`
 * (`modules/csg/csg_shape.cpp:1693`), not three's `CylinderGeometry`. The two disagree visibly on
 * the cone: three gives its collapsed apex one radial normal per segment, and Godot a single
 * averaged one.
 */

import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { buildCsgCylinderGeometry } from './cylinderGeometry';

const DEFAULTS = { radius: 0.5, height: 2, sides: 8, cone: false, smoothFaces: true, flipFaces: false };

function build(overrides: Partial<typeof DEFAULTS> = {}) {
  return buildCsgCylinderGeometry({ ...DEFAULTS, ...overrides });
}

function triangleCount(geometry: THREE.BufferGeometry): number {
  return geometry.getAttribute('position').count / 3;
}

function vertex(geometry: THREE.BufferGeometry, i: number): THREE.Vector3 {
  const p = geometry.getAttribute('position');
  return new THREE.Vector3(p.getX(i), p.getY(i), p.getZ(i));
}

function normal(geometry: THREE.BufferGeometry, i: number): THREE.Vector3 {
  const n = geometry.getAttribute('normal');
  return new THREE.Vector3(n.getX(i), n.getY(i), n.getZ(i));
}

describe('buildCsgCylinderGeometry', () => {
  describe('face counts (csg_shape.cpp:1698)', () => {
    it('emits 4 triangles per side for a cylinder: two wall, one bottom cap, one top cap', () => {
      expect(triangleCount(build({ sides: 8 }))).toBe(4 * 8);
    });

    it('emits 2 per side for a cone: one wall, one bottom cap, and NO top cap', () => {
      expect(triangleCount(build({ sides: 8, cone: true }))).toBe(2 * 8);
    });
  });

  describe('orientation', () => {
    it('places the first ring vertex on +X, not +Z', () => {
      // Godot: `face_base(cos(ang), 0, sin(ang))` with ang = 0 for i = 0, so vertex 0 is
      // at +X. three's CylinderGeometry starts at +Z (x = r*sin, z = r*cos). At 8 sides
      // the vertex set happens to coincide, which is why a smooth-shaded cylinder hides
      // the difference and the faceted cone does not.
      const first = vertex(build({ radius: 0.5, height: 2, sides: 8 }), 0);
      expect(first.x).toBeCloseTo(0.5, 6);
      expect(first.z).toBeCloseTo(0, 6);
      expect(first.y).toBeCloseTo(-1, 6);
    });

    it('spans the full height, half above and half below the origin', () => {
      const geometry = build({ radius: 0.4, height: 1, sides: 12 });
      geometry.computeBoundingBox();
      const box = geometry.boundingBox!;
      expect(box.min.y).toBeCloseTo(-0.5, 6);
      expect(box.max.y).toBeCloseTo(0.5, 6);
      expect(box.max.x).toBeCloseTo(0.4, 6);
    });

    it('collapses the top ring to a point for a cone', () => {
      const geometry = build({ radius: 0.4, height: 1, cone: true, sides: 8 });
      geometry.computeBoundingBox();
      // Only the apex sits at the top, and it is on the axis.
      const top = [...Array(geometry.getAttribute('position').count).keys()]
        .map((i) => vertex(geometry, i))
        .filter((v) => Math.abs(v.y - 0.5) < 1e-6);
      expect(top.length).toBeGreaterThan(0);
      for (const v of top) {
        expect(v.x).toBeCloseTo(0, 6);
        expect(v.z).toBeCloseTo(0, 6);
      }
    });
  });

  describe('smooth_faces', () => {
    it('gives the cone apex ONE averaged normal, not one per segment', () => {
      // three gives nine distinct radial normals here.
      const geometry = build({ radius: 0.4, height: 1, cone: true, sides: 8, smoothFaces: true });
      const apexNormals = [...Array(geometry.getAttribute('position').count).keys()]
        .filter((i) => Math.abs(vertex(geometry, i).y - 0.5) < 1e-6)
        .map((i) => normal(geometry, i));

      expect(apexNormals.length).toBeGreaterThan(1);
      for (const n of apexNormals) {
        expect(n.distanceTo(apexNormals[0]!)).toBeLessThan(1e-6);
      }
      // By symmetry the horizontal contributions cancel, leaving a purely axial normal.
      expect(apexNormals[0]!.x).toBeCloseTo(0, 6);
      expect(apexNormals[0]!.z).toBeCloseTo(0, 6);
      expect(Math.abs(apexNormals[0]!.y)).toBeCloseTo(1, 6);
    });

    it('keeps the caps flat even when smooth_faces is on (csg_shape.cpp:1795, :1810)', () => {
      // Godot hardcodes `smoothw[face] = false` for both caps. A smoothed cap would round
      // the rim over and lose the hard silhouette edge.
      const geometry = build({ sides: 8, smoothFaces: true });
      // Bottom-cap centre vertices sit at exactly (0, -height/2, 0).
      const capCentreNormals = [...Array(geometry.getAttribute('position').count).keys()]
        .filter((i) => {
          const v = vertex(geometry, i);
          return Math.abs(v.y + 1) < 1e-6 && v.x === 0 && v.z === 0;
        })
        .map((i) => normal(geometry, i));
      expect(capCentreNormals.length).toBe(8);
      for (const n of capCentreNormals) {
        expect(Math.abs(n.y)).toBeCloseTo(1, 6);
      }
    });

    it('makes adjacent wall vertices share a normal when smooth, and not when flat', () => {
      const smooth = build({ sides: 8, smoothFaces: true });
      const flat = build({ sides: 8, smoothFaces: false });
      const ringNormal = (g: THREE.BufferGeometry, i: number) => normal(g, i);
      // Wall triangle 0 vertex 0 and wall triangle 1 vertex 1 are the same ring position.
      expect(ringNormal(smooth, 0).length()).toBeCloseTo(1, 6);
      expect(ringNormal(flat, 0).length()).toBeCloseTo(1, 6);
      expect(ringNormal(smooth, 0).distanceTo(ringNormal(flat, 0))).toBeGreaterThan(1e-6);
    });
  });

  describe('degenerate input', () => {
    it('produces empty geometry rather than throwing when sides is below 3', () => {
      expect(triangleCount(build({ sides: 2 }))).toBe(0);
    });
  });
});
