/**
 * decomposeTransform3D reads a Basis as three rows, as Godot serialises it. Reading them as
 * columns transposes every rotation: the ShortWall transform then gives scale.x=6 and
 * rotation.y=-π/2 instead of scale.z=6 and rotation.y=+π/2.
 */

import { describe, it, expect } from 'vitest';
import { parseTransform3D, decomposeTransform3D } from './transform';
import type { Transform3D } from '../nodes/base/node3d/types';

describe('row-major basis regression: 401f8f5 assertions vs current code', () => {
  describe('ShortWall transform (the known smoking gun)', () => {
    it('[401f8f5] scale.z should be 6 for the ShortWall-like transform', () => {
      const transform = parseTransform3D(
        'Transform3D(-4.371139e-08, 0, 6, 0, 1, 0, -1, 0, -2.6226832e-07, 0, 0, 0)'
      );
      const result = decomposeTransform3D(transform);

      expect(result.scale.x).toBeCloseTo(1, 5);
      expect(result.scale.y).toBeCloseTo(1, 5);
      expect(result.scale.z).toBeCloseTo(6, 5);
      expect(result.rotation.y).toBeCloseTo(Math.PI / 2, 5);
    });

    it('[401f8f5] ReferenceWall (no rotation, just Z-scale) should decompose correctly', () => {
      const transformString = 'Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 6, 0, 0, 5)';
      const transform = parseTransform3D(transformString);
      const result = decomposeTransform3D(transform);

      expect(result.rotation.x).toBeCloseTo(0, 5);
      expect(result.rotation.y).toBeCloseTo(0, 5);
      expect(result.rotation.z).toBeCloseTo(0, 5);
      expect(result.scale.x).toBeCloseTo(1, 5);
      expect(result.scale.y).toBeCloseTo(1, 5);
      expect(result.scale.z).toBeCloseTo(6, 5);
      expect(result.position.z).toBeCloseTo(5, 5);
    });
  });

  describe('Y-axis rotation basis (b4ccaab changed the input data in transform.test.ts)', () => {
    it('[pre-b4ccaab] Ry(+pi/2) row-major basis should yield rotation.y = +pi/2', () => {
      // Row-major Ry(+π/2). The column-major form is basis_x={z:-1}, basis_z={x:1}.
      const transform: Transform3D = {
        basis_x: { x: 0, y: 0, z: 1 },
        basis_y: { x: 0, y: 1, z: 0 },
        basis_z: { x: -1, y: 0, z: 0 },
        origin: { x: 0, y: 0, z: 0 },
      };

      const result = decomposeTransform3D(transform);
      expect(result.rotation.y).toBeCloseTo(Math.PI / 2, 5);
    });
  });

  describe('Component.transform.test.tsx rotation basis vectors (d7a69da original WI-R3F-9)', () => {

    it('[d7a69da original] Rx(90°) — column-major input from d7a69da should NOT give rotation.x=+pi/2', () => {
      // Rx(+90°) written column-major is Rx(-90°) read row-major.
      const columnMajorBasis: Transform3D = {
        basis_x: { x: 1, y: 0, z: 0 },
        basis_y: { x: 0, y: 0, z: 1 },   // column-major Rx(+90°)
        basis_z: { x: 0, y: -1, z: 0 },
        origin: { x: 0, y: 0, z: 0 },
      };
      const rowMajorBasis: Transform3D = {
        basis_x: { x: 1, y: 0, z: 0 },
        basis_y: { x: 0, y: 0, z: -1 },  // row-major Rx(+90°)
        basis_z: { x: 0, y: 1, z: 0 },
        origin: { x: 0, y: 0, z: 0 },
      };

      const resultColumn = decomposeTransform3D(columnMajorBasis);
      const resultRow = decomposeTransform3D(rowMajorBasis);

      expect(resultRow.rotation.x).toBeCloseTo(Math.PI / 2, 4);
      expect(resultColumn.rotation.x).toBeCloseTo(-Math.PI / 2, 4);
    });
  });

  describe('end-to-end wall width verification', () => {
    it('ShortWall with origin: FACE_X vertex (0,0,1) maps to world x≈6', () => {
      // The ShortWall is 12 units wide: z∈[-1,1] → x∈[-6,6] after Ry(+π/2) with scale.z=6.
      const transform = parseTransform3D(
        'Transform3D(-4.371139e-08, 0, 6, 0, 1, 0, -1, 0, -2.6226832e-07, 0, 0, 1.75)'
      );
      const result = decomposeTransform3D(transform);

      // Apply TRS to local (0, 0, 1): scale → rotate → translate
      const sz = result.scale.z;
      const ry = result.rotation.y;
      const worldX = Math.sin(ry) * sz * 1 + result.position.x;
      expect(worldX).toBeCloseTo(6, 3);
      expect(result.position.z).toBeCloseTo(1.75, 4);
    });
  });
});
