/**
 * Godot's CSG normal rule, pinned against Godot rather than against our own port.
 *
 * A test whose expectations came from running the transcription would agree with it while
 * both were wrong, so every number here is either hand-computed from the formula in
 * `core/math/plane.h` or forced by symmetry.
 *
 * The bug that motivated this file: `THREE.CylinderGeometry(0, 0.4, 1, 8)` gives the
 * collapsed cone apex NINE distinct radial normals, because three generates one apex
 * vertex per segment and assigns each the segment's own radial direction. Godot keys its
 * accumulation on vertex POSITION, so all nine faces average into one normal. Measured
 * against real Godot 4.6.3, that difference alone put `unit-csg-cylinder.tscn` 0.788%
 * away, 7.9x the visual gate, while its golden sat green because the golden compared us
 * to ourselves.
 */

import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { applyCsgNormals, type CsgFaceSoup } from './smoothNormals';

/** Build a soup from triangles given as flat vertex triples. */
function soupOf(
  triangles: Array<[THREE.Vector3, THREE.Vector3, THREE.Vector3]>,
  { smooth = true, invert = false }: { smooth?: boolean | boolean[]; invert?: boolean } = {}
): CsgFaceSoup {
  const positions = new Float32Array(triangles.length * 9);
  triangles.forEach((tri, t) => {
    tri.forEach((v, j) => {
      positions.set([v.x, v.y, v.z], t * 9 + j * 3);
    });
  });
  return {
    positions,
    uvs: new Float32Array(triangles.length * 6),
    smooth: Array.isArray(smooth) ? smooth : new Array<boolean>(triangles.length).fill(smooth),
    invert,
  };
}

function normalAt(geometry: THREE.BufferGeometry, index: number): THREE.Vector3 {
  const n = geometry.getAttribute('normal');
  return new THREE.Vector3(n.getX(index), n.getY(index), n.getZ(index));
}

function positionAt(geometry: THREE.BufferGeometry, index: number): THREE.Vector3 {
  const p = geometry.getAttribute('position');
  return new THREE.Vector3(p.getX(index), p.getY(index), p.getZ(index));
}

const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

/** An 8-segment cone: apex up at +0.5, base ring of radius 0.4 at -0.5. */
function coneTriangles(segments = 8): Array<[THREE.Vector3, THREE.Vector3, THREE.Vector3]> {
  const apex = v(0, 0.5, 0);
  const ring = Array.from({ length: segments }, (_, i) => {
    const a = (i / segments) * Math.PI * 2;
    return v(0.4 * Math.cos(a), -0.5, 0.4 * Math.sin(a));
  });
  return ring.map((p, i) => [apex, p, ring[(i + 1) % segments]!] as [THREE.Vector3, THREE.Vector3, THREE.Vector3]);
}

describe('applyCsgNormals', () => {
  describe('plane normal (core/math/plane.h Plane(a,b,c), CLOCKWISE default)', () => {
    it('uses (v0-v2) x (v0-v1), the NEGATION of the standard CCW cross product', () => {
      // Hand-computed. v0=(0,0,0) v1=(1,0,0) v2=(0,0,1):
      //   (v0-v2) x (v0-v1) = (0,0,-1) x (-1,0,0) = (0, 1, 0)
      // The standard CCW convention (v1-v0) x (v2-v0) would give (0,-1,0). Getting this
      // backwards flips every normal in every CSG mesh, so it is pinned on its own.
      const geometry = applyCsgNormals(soupOf([[v(0, 0, 0), v(1, 0, 0), v(0, 0, 1)]], { smooth: false }));
      expect(normalAt(geometry, 0).toArray()).toEqual([0, 1, 0]);
    });
  });

  describe('smooth_faces = false', () => {
    it('gives all three vertices of a triangle that triangle own plane normal', () => {
      const geometry = applyCsgNormals(soupOf(coneTriangles(), { smooth: false }));
      for (let t = 0; t < 8; t++) {
        const [a, b, c] = [normalAt(geometry, t * 3), normalAt(geometry, t * 3 + 1), normalAt(geometry, t * 3 + 2)];
        expect(a.distanceTo(b)).toBeLessThan(1e-6);
        expect(b.distanceTo(c)).toBeLessThan(1e-6);
      }
    });

    it('leaves adjacent faces with DIFFERENT normals (no accumulation happens at all)', () => {
      const geometry = applyCsgNormals(soupOf(coneTriangles(), { smooth: false }));
      expect(normalAt(geometry, 0).distanceTo(normalAt(geometry, 3))).toBeGreaterThan(0.1);
    });
  });

  describe('smooth_faces = true, at a collapsed vertex', () => {
    it('gives every face meeting at the cone apex the SAME normal', () => {
      // This is the whole point. three.js gives nine different radial normals here.
      const geometry = applyCsgNormals(soupOf(coneTriangles()));
      const first = normalAt(geometry, 0);
      for (let t = 1; t < 8; t++) {
        expect(normalAt(geometry, t * 3).distanceTo(first)).toBeLessThan(1e-6);
      }
    });

    it('makes that shared apex normal axial, because the contributions cancel by symmetry', () => {
      const geometry = applyCsgNormals(soupOf(coneTriangles()));
      const apex = normalAt(geometry, 0);
      expect(apex.x).toBeCloseTo(0, 6);
      expect(apex.z).toBeCloseTo(0, 6);
      expect(Math.abs(apex.y)).toBeCloseTo(1, 6);
    });

    it('still varies the base-ring normals per position (smoothing is per-vertex, not per-mesh)', () => {
      const geometry = applyCsgNormals(soupOf(coneTriangles()));
      // Vertex 1 of face 0 and vertex 1 of face 2 are different ring positions.
      expect(normalAt(geometry, 1).distanceTo(normalAt(geometry, 7))).toBeGreaterThan(0.1);
    });

    it('accumulates unweighted unit plane normals, not area-weighted ones', () => {
      // Two smooth right triangles sharing the origin, deliberately very different in
      // area: one in the XY plane, one 100x larger in the XZ plane. Godot sums the two
      // UNIT plane normals, so the shared vertex bisects them exactly. An area-weighted
      // average (what most engines do, and what computeVertexNormals does NOT do either)
      // would sit almost entirely on the large triangle's normal.
      const small: [THREE.Vector3, THREE.Vector3, THREE.Vector3] = [v(0, 0, 0), v(1, 0, 0), v(0, 1, 0)];
      const large: [THREE.Vector3, THREE.Vector3, THREE.Vector3] = [v(0, 0, 0), v(0, 0, 100), v(100, 0, 0)];
      const geometry = applyCsgNormals(soupOf([small, large]));
      const shared = normalAt(geometry, 0);
      const smallN = new THREE.Vector3()
        .subVectors(v(0, 0, 0), v(0, 1, 0))
        .cross(new THREE.Vector3().subVectors(v(0, 0, 0), v(1, 0, 0)))
        .normalize();
      const largeN = new THREE.Vector3()
        .subVectors(v(0, 0, 0), v(100, 0, 0))
        .cross(new THREE.Vector3().subVectors(v(0, 0, 0), v(0, 0, 100)))
        .normalize();
      const bisector = smallN.clone().add(largeN).normalize();
      expect(shared.distanceTo(bisector)).toBeLessThan(1e-6);
    });

    it('does not let a flat face contribute to, or read from, the accumulation', () => {
      // Godot only writes the map for smooth faces and only reads it for smooth faces.
      const tris = coneTriangles();
      const smooth = new Array<boolean>(8).fill(true);
      smooth[0] = false;
      const mixed = applyCsgNormals(soupOf(tris, { smooth }));
      const allSmooth = applyCsgNormals(soupOf(tris));

      // The flat face keeps its own plane normal, ignoring the map entirely.
      const ownPlane = new THREE.Vector3()
        .subVectors(tris[0]![0], tris[0]![2])
        .cross(new THREE.Vector3().subVectors(tris[0]![0], tris[0]![1]))
        .normalize();
      expect(normalAt(mixed, 0).distanceTo(ownPlane)).toBeLessThan(1e-6);

      // And its absence changes what the remaining smooth faces average to.
      expect(normalAt(mixed, 3).distanceTo(normalAt(allSmooth, 3))).toBeGreaterThan(1e-6);
    });
  });

  describe('winding: Godot fronts are CLOCKWISE, three fronts are COUNTER-CLOCKWISE', () => {
    it('reverses the winding on the way out, so faces are not back-face culled', () => {
      // Emitting Godot's vertex order verbatim culls every triangle and renders each
      // solid as its own interior. Measured, that took unit-csg-cylinder from 0.788% to
      // 4.223% against real Godot before this conversion was added.
      const tri: [THREE.Vector3, THREE.Vector3, THREE.Vector3] = [v(0, 0, 0), v(1, 0, 0), v(0, 0, 1)];
      const geometry = applyCsgNormals(soupOf([tri], { smooth: false }));
      expect(positionAt(geometry, 0).toArray()).toEqual([0, 0, 0]);
      expect(positionAt(geometry, 1).toArray()).toEqual([0, 0, 1]);
      expect(positionAt(geometry, 2).toArray()).toEqual([1, 0, 0]);
    });

    it('leaves the normal alone, since it is supplied explicitly and not derived from winding', () => {
      const geometry = applyCsgNormals(soupOf([[v(0, 0, 0), v(1, 0, 0), v(0, 0, 1)]], { smooth: false }));
      expect(normalAt(geometry, 0).toArray()).toEqual([0, 1, 0]);
    });
  });

  describe('invert (Godot face.invert, the CSGPrimitive3D flip_faces property)', () => {
    it('negates the normal', () => {
      const tri: [THREE.Vector3, THREE.Vector3, THREE.Vector3] = [v(0, 0, 0), v(1, 0, 0), v(0, 0, 1)];
      const plain = applyCsgNormals(soupOf([tri], { smooth: false }));
      const flipped = applyCsgNormals(soupOf([tri], { smooth: false, invert: true }));
      expect(normalAt(flipped, 0).toArray()).toEqual(normalAt(plain, 0).negate().toArray());
    });

    it('cancels the CW-to-CCW reversal, leaving Godot source order', () => {
      // Godot's own invert swap and our winding conversion are both a 1<->2 swap, so
      // together they compose back to the source order.
      const tri: [THREE.Vector3, THREE.Vector3, THREE.Vector3] = [v(0, 0, 0), v(1, 0, 0), v(0, 0, 1)];
      const flipped = applyCsgNormals(soupOf([tri], { smooth: false, invert: true }));
      expect(positionAt(flipped, 0).toArray()).toEqual([0, 0, 0]);
      expect(positionAt(flipped, 1).toArray()).toEqual([1, 0, 0]);
      expect(positionAt(flipped, 2).toArray()).toEqual([0, 0, 1]);
    });
  });

  describe('output shape', () => {
    it('is non-indexed with position, normal and uv attributes', () => {
      const geometry = applyCsgNormals(soupOf(coneTriangles()));
      expect(geometry.index).toBeNull();
      expect(geometry.getAttribute('position').count).toBe(24);
      expect(geometry.getAttribute('normal').count).toBe(24);
      // three-bvh-csg's default `attributes` list is position/uv/normal; a brush missing
      // any of them has that channel trimmed from the boolean result.
      expect(geometry.getAttribute('uv').count).toBe(24);
    });

    it('returns empty geometry for an empty soup rather than throwing', () => {
      const geometry = applyCsgNormals(soupOf([]));
      expect(geometry.getAttribute('position').count).toBe(0);
    });
  });
});
