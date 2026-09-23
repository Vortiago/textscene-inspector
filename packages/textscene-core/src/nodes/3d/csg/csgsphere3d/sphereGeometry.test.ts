/**
 * CSGSphere3D geometry, pinned against `CSGSphere3D::_build_brush`
 * (`modules/csg/csg_shape.cpp:1324`). The poles are collapsed vertices, where three's
 * per-segment normals and Godot's position-keyed averaging part company, as on the CSGCylinder3D
 * cone. A sphere hides it better only because its default tessellation is finer.
 */

import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { buildCsgSphereGeometry } from './sphereGeometry';

const DEFAULTS = { radius: 0.5, radialSegments: 12, rings: 6, smoothFaces: true, flipFaces: false };

function build(overrides: Partial<typeof DEFAULTS> = {}) {
  return buildCsgSphereGeometry({ ...DEFAULTS, ...overrides });
}

function vertices(geometry: THREE.BufferGeometry): THREE.Vector3[] {
  const p = geometry.getAttribute('position');
  return [...Array(p.count).keys()].map((i) => new THREE.Vector3(p.getX(i), p.getY(i), p.getZ(i)));
}

function normalsAt(geometry: THREE.BufferGeometry, predicate: (v: THREE.Vector3) => boolean) {
  const n = geometry.getAttribute('normal');
  return vertices(geometry)
    .map((v, i) => ({ v, n: new THREE.Vector3(n.getX(i), n.getY(i), n.getZ(i)) }))
    .filter(({ v }) => predicate(v))
    .map(({ n: normal }) => normal);
}

describe('buildCsgSphereGeometry', () => {
  it('emits two triangles per segment per ring, minus one at each pole (csg_shape.cpp:1329)', () => {
    const geometry = build({ radialSegments: 12, rings: 6 });
    expect(geometry.getAttribute('position').count / 3).toBe(6 * 12 * 2 - 12 * 2);
  });

  it('puts the poles on the Y axis at exactly +/- radius', () => {
    const geometry = build({ radius: 0.5 });
    geometry.computeBoundingBox();
    const box = geometry.boundingBox!;
    expect(box.min.y).toBeCloseTo(-0.5, 6);
    expect(box.max.y).toBeCloseTo(0.5, 6);
    for (const v of vertices(geometry).filter((v) => Math.abs(Math.abs(v.y) - 0.5) < 1e-9)) {
      expect(v.x).toBeCloseTo(0, 9);
      expect(v.z).toBeCloseTo(0, 9);
    }
  });

  it('gives sin to X and cos to Z, so the first segment starts on +Z', () => {
    // Godot's comment: "We give sin to X and cos to Z on purpose. This allows UVs to be
    // CCW on +X so it maps to images well." longitude 0 therefore lands on +Z.
    const geometry = build({ radius: 1, radialSegments: 4, rings: 4 });
    const equator = vertices(geometry).filter((v) => Math.abs(v.y) < 1e-9);
    expect(equator.some((v) => Math.abs(v.z - 1) < 1e-6 && Math.abs(v.x) < 1e-6)).toBe(true);
  });

  it('gives every triangle meeting at a pole the SAME normal', () => {
    // three's SphereGeometry gives one per segment; Godot averages them by position.
    const geometry = build({ radialSegments: 12, rings: 6, smoothFaces: true });
    const north = normalsAt(geometry, (v) => v.y > 0.49999);
    expect(north.length).toBeGreaterThan(1);
    for (const n of north) expect(n.distanceTo(north[0]!)).toBeLessThan(1e-6);
    expect(north[0]!.x).toBeCloseTo(0, 6);
    expect(north[0]!.z).toBeCloseTo(0, 6);
    expect(north[0]!.y).toBeCloseTo(1, 6);
  });

  it('makes smooth normals radial, matching the analytic sphere normal', () => {
    const geometry = build({ radius: 0.5, radialSegments: 24, rings: 12, smoothFaces: true });
    const p = geometry.getAttribute('position');
    const n = geometry.getAttribute('normal');
    for (const i of [5, 40, 120]) {
      const pos = new THREE.Vector3(p.getX(i), p.getY(i), p.getZ(i)).normalize();
      const nor = new THREE.Vector3(n.getX(i), n.getY(i), n.getZ(i));
      expect(nor.distanceTo(pos)).toBeLessThan(0.05);
    }
  });

  it('gives flat shading a per-face normal when smooth_faces is off', () => {
    const geometry = build({ smoothFaces: false });
    const n = geometry.getAttribute('normal');
    for (let t = 0; t < 5; t++) {
      const a = new THREE.Vector3(n.getX(t * 3), n.getY(t * 3), n.getZ(t * 3));
      const b = new THREE.Vector3(n.getX(t * 3 + 1), n.getY(t * 3 + 1), n.getZ(t * 3 + 1));
      expect(a.distanceTo(b)).toBeLessThan(1e-6);
    }
  });

  it('produces empty geometry rather than throwing on degenerate tessellation', () => {
    expect(build({ radialSegments: 2 }).getAttribute('position').count).toBe(0);
    expect(build({ rings: 1 }).getAttribute('position').count).toBe(0);
  });
});
