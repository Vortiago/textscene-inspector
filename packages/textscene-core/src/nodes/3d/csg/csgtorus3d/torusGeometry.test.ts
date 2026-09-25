/**
 * CSGTorus3D geometry, pinned against `CSGTorus3D::_build_brush` (`modules/csg/csg_shape.cpp:1925`).
 * Godot's ring lies in XZ with the hole on +Y, where `THREE.TorusGeometry` lies in XY with the
 * hole on +Z, and Godot's `sides` counts segments around the ring where three's `radialSegments`
 * counts them around the tube. Either error still looks like a torus.
 */

import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { buildCsgTorusGeometry } from './torusGeometry';

const DEFAULTS = {
  innerRadius: 0.5,
  outerRadius: 1,
  sides: 8,
  ringSides: 6,
  smoothFaces: true,
  flipFaces: false,
};

function build(overrides: Partial<typeof DEFAULTS> = {}) {
  return buildCsgTorusGeometry({ ...DEFAULTS, ...overrides });
}

function box(geometry: THREE.BufferGeometry): THREE.Box3 {
  geometry.computeBoundingBox();
  return geometry.boundingBox!;
}

describe('buildCsgTorusGeometry', () => {
  describe('orientation: the ring is in XZ and the hole axis is +Y', () => {
    it('makes the tube radius the Y extent, not the ring radius', () => {
      // tube = (0.4 - 0.25) / 2 = 0.075. Forget that Godot's ring is in XZ while three's
      // TorusGeometry is in XY and max.y comes out at 0.4 instead, a 5x error that still
      // looks like a torus. Tessellated finely here so the extent is the true radius.
      const b = box(build({ innerRadius: 0.25, outerRadius: 0.4, sides: 64, ringSides: 64 }));
      expect(b.max.y).toBeCloseTo(0.075, 3);
      expect(b.min.y).toBeCloseTo(-0.075, 3);
      expect(b.max.x).toBeCloseTo(0.4, 3);
      expect(b.max.z).toBeCloseTo(0.4, 3);
    });

    it('inscribes the cross-section polygon, so a coarse tube is smaller than its radius', () => {
      // The vendored witness, scenes/demos/3d/csg/csg.tscn:268, with ring_sides = 5. No
      // cross-section vertex lands at the top of the circle, so the Y extent is
      // tube * sin(72 degrees), not tube. Asserting the round number here would be
      // asserting a smooth tube Godot never builds.
      const b = box(build({ innerRadius: 0.25, outerRadius: 0.4, sides: 32, ringSides: 5 }));
      expect(b.max.y).toBeCloseTo(0.075 * Math.sin((2 * Math.PI) / 5), 6);
    });

    it('leaves a hole of the inner radius through the middle', () => {
      const geometry = build({ innerRadius: 0.25, outerRadius: 0.4, sides: 64, ringSides: 32 });
      const p = geometry.getAttribute('position');
      let closest = Infinity;
      for (let i = 0; i < p.count; i++) {
        closest = Math.min(closest, Math.hypot(p.getX(i), p.getZ(i)));
      }
      expect(closest).toBeCloseTo(0.25, 2);
    });
  });

  describe('segment counts (sides = around the ring, ring_sides = around the tube)', () => {
    it('emits two triangles per (side, ring_side) pair', () => {
      expect(build({ sides: 8, ringSides: 6 }).getAttribute('position').count / 3).toBe(8 * 6 * 2);
    });

    it('treats the two counts as distinct, not interchangeable', () => {
      // A mapping that swapped them would make these two identical.
      const a = build({ sides: 16, ringSides: 4 });
      const b = build({ sides: 4, ringSides: 16 });
      const ringPositions = (g: THREE.BufferGeometry) => {
        const p = g.getAttribute('position');
        const angles = new Set<string>();
        for (let i = 0; i < p.count; i++) {
          angles.add(Math.atan2(p.getZ(i), p.getX(i)).toFixed(4));
        }
        return angles.size;
      };
      expect(ringPositions(a)).toBeGreaterThan(ringPositions(b));
    });
  });

  describe('degenerate radii (csg_shape.cpp:1928-1937)', () => {
    it('produces an empty brush when the radii are equal', () => {
      expect(build({ innerRadius: 0.5, outerRadius: 0.5 }).getAttribute('position').count).toBe(0);
    });

    it('SWAPS inverted radii rather than clamping them', () => {
      const swapped = box(build({ innerRadius: 1, outerRadius: 0.5 }));
      const normal = box(build({ innerRadius: 0.5, outerRadius: 1 }));
      expect(swapped.max.x).toBeCloseTo(normal.max.x, 6);
      expect(swapped.max.y).toBeCloseTo(normal.max.y, 6);
    });

    it('produces empty geometry rather than throwing below 3 segments', () => {
      expect(build({ sides: 2 }).getAttribute('position').count).toBe(0);
      expect(build({ ringSides: 2 }).getAttribute('position').count).toBe(0);
    });
  });

  describe('smooth_faces (Godot defaults this to TRUE for a torus)', () => {
    it('shares normals across the seam where the ring closes', () => {
      // The last segment snaps back to angle 0 so the seam vertices are the exact same
      // float; if they were not, the position-keyed accumulation would leave a crease.
      const geometry = build({ sides: 8, ringSides: 6, smoothFaces: true });
      const p = geometry.getAttribute('position');
      const n = geometry.getAttribute('normal');
      const byPosition = new Map<string, THREE.Vector3[]>();
      for (let i = 0; i < p.count; i++) {
        const key = `${p.getX(i).toFixed(6)},${p.getY(i).toFixed(6)},${p.getZ(i).toFixed(6)}`;
        const list = byPosition.get(key) ?? [];
        list.push(new THREE.Vector3(n.getX(i), n.getY(i), n.getZ(i)));
        byPosition.set(key, list);
      }
      // Every shared position must carry one agreed normal.
      for (const normals of byPosition.values()) {
        for (const nrm of normals) expect(nrm.distanceTo(normals[0]!)).toBeLessThan(1e-6);
      }
      // And the seam really is shared, not duplicated.
      expect(byPosition.size).toBe(8 * 6);
    });

    it('gives each triangle its own normal when smooth_faces is off', () => {
      const geometry = build({ smoothFaces: false });
      const n = geometry.getAttribute('normal');
      for (let t = 0; t < 6; t++) {
        const a = new THREE.Vector3(n.getX(t * 3), n.getY(t * 3), n.getZ(t * 3));
        const b = new THREE.Vector3(n.getX(t * 3 + 1), n.getY(t * 3 + 1), n.getZ(t * 3 + 1));
        expect(a.distanceTo(b)).toBeLessThan(1e-6);
      }
    });
  });
});
