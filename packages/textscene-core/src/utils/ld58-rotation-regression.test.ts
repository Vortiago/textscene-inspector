/**
 * Regression tests for LD-58 hallway transforms that exercise rotation axes
 * the wall-width suite never touched.
 *
 * `ld58-wall-regression.test.ts` covers the Ry(+90°) walls and the pure
 * Z-scale ShortWall. This suite complements it with the decompose stress
 * cases that the 2026-05-29 positioning hunt confirmed were ALSO correct
 * after the 99c1479 row-vector fix — the cases the user suspected might
 * still be wrong ("ceiling lamps, a photo or window frame... other maths
 * that are now wrong"):
 *
 *   - Rz(180°)            LongCorridor/Ceiling (PlaneMesh)
 *   - Ry(180°) + Z-scale  ShortCorridor/LongWall
 *   - Rz(-90°)            WallSection/CrownMolding (PrismMesh)
 *
 * The point is convention robustness. A column-major / transpose regression
 * in decomposeTransform3D would mis-map these axes or leak rotation into
 * scale. The asymmetric Rz(-90°) crown-molding case is the decisive
 * discriminator: its axis mapping is only correct under the Godot row-vector
 * convention (a transpose would map local X -> +Y instead of -Y).
 *
 * Ground truth confirmed in:
 *   D:/CodeRepos/ld-58/HallwayGeometry.tscn        (Ceiling, LongWall)
 *   D:/CodeRepos/ld-58/components/WallSection.tscn  (CrownMolding)
 *
 * Godot Basis = Vector3 rows[3]: row0=(a,b,c) row1=(d,e,f) row2=(g,h,i),
 * world = Basis*p + origin (world.x = row0·p + ox, ...).
 *
 * Treat the constants here as fixture data — if a refactor changes them, the
 * refactor is almost certainly wrong.
 */
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { parseTransform3D, decomposeTransform3D } from './transform';

const HALF_PI = Math.PI / 2;

/** Compose a Transform3D string the way R3F does for <group position rotation scale>. */
function composeObject(transformString: string): THREE.Object3D {
  const d = decomposeTransform3D(parseTransform3D(transformString));
  const o = new THREE.Object3D();
  o.position.set(d.position.x, d.position.y, d.position.z);
  o.rotation.set(d.rotation.x, d.rotation.y, d.rotation.z);
  o.scale.set(d.scale.x, d.scale.y, d.scale.z);
  o.updateMatrix();
  return o;
}

describe('LD-58 hallway rotation/scale decompose — regression suite', () => {
  describe('LongCorridor/Ceiling — Rz(180°) PlaneMesh', () => {
    // rows: r0=(-1, 8.74e-08, 0) r1=(-8.74e-08, -1, 0) r2=(0,0,1) origin=(0,4,0)
    // X-col≈-X, Y-col≈-Y, Z-col=+Z => Rz(180°): x->-x, y->-y, z->z. det=+1, unit scale.
    const CEILING = 'Transform3D(-1, 8.742278e-08, 0, -8.742278e-08, -1, 0, 0, 0, 1, 0, 4, 0)';

    it('decomposes to unit scale (no rotation leakage) at origin (0, 4, 0)', () => {
      const d = decomposeTransform3D(parseTransform3D(CEILING));
      expect(d.scale.x).toBeCloseTo(1, 4);
      expect(d.scale.y).toBeCloseTo(1, 4);
      expect(d.scale.z).toBeCloseTo(1, 4);
      expect(d.position.x).toBeCloseTo(0, 4);
      expect(d.position.y).toBeCloseTo(4, 4);
      expect(d.position.z).toBeCloseTo(0, 4);
    });

    it('maps unit axes as Rz(180°): X->-X, Y->-Y, Z->+Z', () => {
      // Asserted via the composed matrix so the result is euler-convention
      // independent (Rz180 can be expressed as z=±π or x=π,y=0).
      const o = composeObject(CEILING);
      const xMapped = new THREE.Vector3(1, 0, 0).transformDirection(o.matrix);
      const yMapped = new THREE.Vector3(0, 1, 0).transformDirection(o.matrix);
      const zMapped = new THREE.Vector3(0, 0, 1).transformDirection(o.matrix);
      expect(xMapped.x).toBeCloseTo(-1, 4);
      expect(yMapped.y).toBeCloseTo(-1, 4);
      expect(zMapped.z).toBeCloseTo(1, 4);
    });

    it('ceiling plane vertex (1,0,1) lands at world y=4 (x flipped, z unchanged)', () => {
      const v = new THREE.Vector3(1, 0, 1).applyMatrix4(composeObject(CEILING).matrix);
      expect(v.y).toBeCloseTo(4, 4);
      expect(v.x).toBeCloseTo(-1, 4);
      expect(v.z).toBeCloseTo(1, 4);
    });
  });

  describe('ShortCorridor/LongWall — Ry(180°) with Z-scale=5.25', () => {
    // rows: r0=(-1,0,-7.93e-07) r1=(0,1,0) r2=(1.51e-07,0,-5.25) origin=(4.25,0,3.5)
    // X-col≈-X, Y-col=+Y, Z-col≈-Z(len 5.25) => Ry(180°) with scale.z=5.25.
    const LONG_WALL =
      'Transform3D(-1, 0, -7.92728e-07, 0, 1, 0, 1.509958e-07, 0, -5.25, 4.25, 0, 3.5)';

    it('captures the 5.25 stretch in scale.z (not in rotation) at origin (4.25, 0, 3.5)', () => {
      const d = decomposeTransform3D(parseTransform3D(LONG_WALL));
      expect(d.scale.x).toBeCloseTo(1, 4);
      expect(d.scale.y).toBeCloseTo(1, 4);
      expect(d.scale.z).toBeCloseTo(5.25, 4);
      expect(d.position.x).toBeCloseTo(4.25, 4);
      expect(d.position.y).toBeCloseTo(0, 4);
      expect(d.position.z).toBeCloseTo(3.5, 4);
    });

    it('maps unit axes as Ry(180°): X->-X, Y->+Y, Z->-Z', () => {
      const o = composeObject(LONG_WALL);
      const xMapped = new THREE.Vector3(1, 0, 0).transformDirection(o.matrix);
      const yMapped = new THREE.Vector3(0, 1, 0).transformDirection(o.matrix);
      const zMapped = new THREE.Vector3(0, 0, 1).transformDirection(o.matrix);
      expect(xMapped.x).toBeCloseTo(-1, 4);
      expect(yMapped.y).toBeCloseTo(1, 4);
      expect(zMapped.z).toBeCloseTo(-1, 4);
    });

    it('plane x-edges span 2 units along world X (3.25 .. 5.25)', () => {
      const o = composeObject(LONG_WALL);
      const eRight = new THREE.Vector3(1, 0, 0).applyMatrix4(o.matrix);
      const eLeft = new THREE.Vector3(-1, 0, 0).applyMatrix4(o.matrix);
      expect(eRight.x).toBeCloseTo(3.25, 4);
      expect(eLeft.x).toBeCloseTo(5.25, 4);
      expect(Math.abs(eLeft.x - eRight.x)).toBeCloseTo(2, 4);
    });

    it('local (0,0,1) moves 5.25 along world -Z -> world.z = -1.75', () => {
      const zEdge = new THREE.Vector3(0, 0, 1).applyMatrix4(composeObject(LONG_WALL).matrix);
      expect(zEdge.z).toBeCloseTo(-1.75, 4);
    });
  });

  describe('WallSection/CrownMolding — Rz(-90°) PrismMesh (the decisive asymmetric case)', () => {
    // rows: r0=(-4.37e-08, 1, 0) r1=(-1, -4.37e-08, 0) r2=(0,0,1) origin=(0.125,3.95,0)
    // X-col≈-Y, Y-col≈+X => Rz(θ) with X->-Y, Y->+X means θ=-90°, euler.z=-π/2.
    // A transpose/column-major regression would instead give X->+Y (euler.z=+π/2).
    const CROWN_MOLDING =
      'Transform3D(-4.371139e-08, 1, 0, -1, -4.371139e-08, 0, 0, 0, 1, 0.125, 3.95, 0)';

    it('decomposes to pure Rz(-90°) with unit scale at origin (0.125, 3.95, 0)', () => {
      const d = decomposeTransform3D(parseTransform3D(CROWN_MOLDING));
      expect(d.scale.x).toBeCloseTo(1, 4);
      expect(d.scale.y).toBeCloseTo(1, 4);
      expect(d.scale.z).toBeCloseTo(1, 4);
      expect(d.position.x).toBeCloseTo(0.125, 4);
      expect(d.position.y).toBeCloseTo(3.95, 4);
      expect(d.position.z).toBeCloseTo(0, 4);
      expect(d.rotation.x).toBeCloseTo(0, 4);
      expect(d.rotation.y).toBeCloseTo(0, 4);
      // Sign matters: Godot row math => Rz(-90°), NOT +90°.
      expect(d.rotation.z).toBeCloseTo(-HALF_PI, 4);
    });

    it('maps local X -> world -Y and local Y -> world +X (row-convention discriminator)', () => {
      const o = composeObject(CROWN_MOLDING);
      const xMapped = new THREE.Vector3(1, 0, 0).transformDirection(o.matrix);
      const yMapped = new THREE.Vector3(0, 1, 0).transformDirection(o.matrix);
      expect(xMapped.x).toBeCloseTo(0, 4);
      expect(xMapped.y).toBeCloseTo(-1, 4);
      expect(yMapped.x).toBeCloseTo(1, 4);
      expect(yMapped.y).toBeCloseTo(0, 4);
    });

    it('molding vertices map correctly: local (0,1,0)->world (1.125, 3.95), local (1,0,0)->world (0.125, 2.95)', () => {
      const o = composeObject(CROWN_MOLDING);
      const vTop = new THREE.Vector3(0, 1, 0).applyMatrix4(o.matrix);
      expect(vTop.x).toBeCloseTo(1.125, 4);
      expect(vTop.y).toBeCloseTo(3.95, 4);
      const vSide = new THREE.Vector3(1, 0, 0).applyMatrix4(o.matrix);
      expect(vSide.x).toBeCloseTo(0.125, 4);
      expect(vSide.y).toBeCloseTo(2.95, 4);
    });
  });
});
