/**
 * Regression tests for the hallway wall transforms.
 *
 * These tests use the actual Transform3D values captured from a real-world
 * hallway scene (its RoomGeometry.tscn). Two regressions silently
 * broke wall rendering in the R3F migration before it was noticed:
 *
 *   1. b4ccaab rewrote the 401f8f5 Transform3D row-vector
 *      test assertions to match buggy column-major output. The visible
 *      effect: walls rendered at 1/3 to 1/6 their intended width.
 *      Restored by 99c1479 (decomposeTransform3D fix) and these tests.
 *
 *   2. 67c199b made PlaneMesh + unset cull_mode default to
 *      DoubleSide. The visible effect: walls visible from both sides
 *      so you could see "through" the corridor. Restored by the
 *      MaterialSlot revert and Component.planemesh-side.test.tsx.
 *
 * Treat the constants here as fixture data — if they get touched
 * during refactor, the refactor is almost certainly wrong.
 */
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { parseTransform3D, decomposeTransform3D } from './transform';

describe('hallway wall transforms — regression suite', () => {
  // Apply the decomposed TRS to a THREE.Object3D to replicate exactly
  // what the R3F render pipeline does (<group position rotation scale>).
  function worldPosFor(transformString: string, localX: number, localY: number, localZ: number) {
    const t = parseTransform3D(transformString);
    const d = decomposeTransform3D(t);
    const o = new THREE.Object3D();
    o.position.set(d.position.x, d.position.y, d.position.z);
    o.rotation.set(d.rotation.x, d.rotation.y, d.rotation.z);
    o.scale.set(d.scale.x, d.scale.y, d.scale.z);
    o.updateMatrix();
    const v = new THREE.Vector3(localX, localY, localZ).applyMatrix4(o.matrix);
    return v;
  }

  describe('ShortCorridor/ShortWall (Transform3D with no rotation, Z-scale=3.5)', () => {
    const SHORT_WALL = 'Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 3.5, -1.75, 0, 5.25)';

    it('decomposes to scale=(1, 1, 3.5) with identity rotation', () => {
      const d = decomposeTransform3D(parseTransform3D(SHORT_WALL));
      expect(d.scale.x).toBeCloseTo(1, 5);
      expect(d.scale.y).toBeCloseTo(1, 5);
      expect(d.scale.z).toBeCloseTo(3.5, 5);
      expect(d.rotation.x).toBeCloseTo(0, 5);
      expect(d.rotation.y).toBeCloseTo(0, 5);
      expect(d.rotation.z).toBeCloseTo(0, 5);
      expect(d.position).toEqual({ x: -1.75, y: 0, z: 5.25 });
    });

    it('local (0, 0, 1) -> world (-1.75, 0, 8.75) — wall extends 3.5 forward in Z', () => {
      const w = worldPosFor(SHORT_WALL, 0, 0, 1);
      expect(w.x).toBeCloseTo(-1.75, 4);
      expect(w.y).toBeCloseTo(0, 4);
      expect(w.z).toBeCloseTo(8.75, 4);
    });

    it('local (0, 0, -1) -> world (-1.75, 0, 1.75) — wall extends 3.5 backward in Z', () => {
      const w = worldPosFor(SHORT_WALL, 0, 0, -1);
      expect(w.x).toBeCloseTo(-1.75, 4);
      expect(w.y).toBeCloseTo(0, 4);
      expect(w.z).toBeCloseTo(1.75, 4);
    });
  });

  describe('ShortCorridor/EndWall (Transform3D with 90° Y-rotation + X-scale=3 in basis)', () => {
    const END_WALL =
      'Transform3D(-4.371139e-08, 0, 3, 0, 1, 0, -1, 0, -1.3113416e-07, 1.2504363, 0, 8.75)';

    it('decomposes to scale=(1, 1, 3) with +π/2 Y rotation', () => {
      const d = decomposeTransform3D(parseTransform3D(END_WALL));
      expect(d.scale.x).toBeCloseTo(1, 5);
      expect(d.scale.y).toBeCloseTo(1, 5);
      expect(d.scale.z).toBeCloseTo(3, 5);
      expect(d.rotation.y).toBeCloseTo(Math.PI / 2, 5);
      expect(d.position.x).toBeCloseTo(1.2504363, 5);
      expect(d.position.y).toBeCloseTo(0, 5);
      expect(d.position.z).toBeCloseTo(8.75, 5);
    });

    it('local (0, 0, 1) -> world (4.25, 0, 8.75) — wall extends to +6/2=+3 in world X then offset by 1.25', () => {
      const w = worldPosFor(END_WALL, 0, 0, 1);
      expect(w.x).toBeCloseTo(4.2504363, 4);
      expect(w.y).toBeCloseTo(0, 4);
      expect(w.z).toBeCloseTo(8.75, 4);
    });

    it('local (0, 0, -1) -> world (-1.75, 0, 8.75) — wall extends to -3 from offset, giving width 6', () => {
      const w = worldPosFor(END_WALL, 0, 0, -1);
      expect(w.x).toBeCloseTo(-1.7495637, 4);
      expect(w.y).toBeCloseTo(0, 4);
      expect(w.z).toBeCloseTo(8.75, 4);
    });

    it('total wall width along world X is 6 units (3 × 2 from PlaneMesh.size.y=4 ÷ 2 then scaled by 3)', () => {
      // PlaneMesh FACE_X with size=Vector2(2, 4) has vertices at
      // (0, ±2, ±1) in local space (size.x=2 -> Z extent ±1).
      const front = worldPosFor(END_WALL, 0, 0, 1);
      const back = worldPosFor(END_WALL, 0, 0, -1);
      expect(Math.abs(front.x - back.x)).toBeCloseTo(6, 4);
    });
  });

  describe('LongCorridor/ShortWall (Transform3D with 90° Y-rotation + X-scale=6)', () => {
    const LONG_SHORT_WALL =
      'Transform3D(-4.371139e-08, 0, 6, 0, 1, 0, -1, 0, -2.6226832e-07, 0, 0, 1.75)';

    it('decomposes to scale=(1, 1, 6) with +π/2 Y rotation', () => {
      const d = decomposeTransform3D(parseTransform3D(LONG_SHORT_WALL));
      expect(d.scale.x).toBeCloseTo(1, 5);
      expect(d.scale.y).toBeCloseTo(1, 5);
      expect(d.scale.z).toBeCloseTo(6, 5);
      expect(d.rotation.y).toBeCloseTo(Math.PI / 2, 5);
    });

    it('local (0, 0, 1) -> world.x ≈ 6 (wall extends 6 forward in X from origin x=0)', () => {
      const w = worldPosFor(LONG_SHORT_WALL, 0, 0, 1);
      expect(w.x).toBeCloseTo(6, 4);
      expect(w.y).toBeCloseTo(0, 4);
      expect(w.z).toBeCloseTo(1.75, 4);
    });

    it('total wall width along world X is 12 units', () => {
      const front = worldPosFor(LONG_SHORT_WALL, 0, 0, 1);
      const back = worldPosFor(LONG_SHORT_WALL, 0, 0, -1);
      expect(Math.abs(front.x - back.x)).toBeCloseTo(12, 4);
    });
  });

  describe('LongCorridor/LongWall (Transform3D with mirrored 90° rotation + X-scale=9)', () => {
    const LONG_LONG_WALL =
      'Transform3D(-4.371139e-08, 0, -9, 0, 1, 0, 1, 0, -3.934025e-07, 3, 0, -1.75)';

    it('decomposes with scale.z=9 (absolute) — total wall width 18 units along world X', () => {
      const front = worldPosFor(LONG_LONG_WALL, 0, 0, 1);
      const back = worldPosFor(LONG_LONG_WALL, 0, 0, -1);
      expect(Math.abs(front.x - back.x)).toBeCloseTo(18, 4);
    });
  });

  describe('the regression signature', () => {
    // If decomposeTransform3D regresses back to the b4ccaab column-major
    // interpretation, these checks fail in a very specific way:
    //   scale.x = 6 instead of scale.z = 6 for the ShortWall above.
    //   That mis-assigned scale on a FACE_X plane (vertices x=0) has
    //   zero visual effect — making the wall appear 1/6 of its true
    //   width along world X. The test below explicitly proves we are
    //   NOT in the buggy regime.
    it('NOT the b4ccaab regression: ShortWall scale.x !== 6, scale.z === 6', () => {
      const d = decomposeTransform3D(
        parseTransform3D(
          'Transform3D(-4.371139e-08, 0, 6, 0, 1, 0, -1, 0, -2.6226832e-07, 0, 0, 1.75)'
        )
      );
      expect(d.scale.x).not.toBeCloseTo(6, 4);
      expect(d.scale.z).toBeCloseTo(6, 5);
    });
  });
});
