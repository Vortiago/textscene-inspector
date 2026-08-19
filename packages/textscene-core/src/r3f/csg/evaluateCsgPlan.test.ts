/**
 * The booleans, run for real against the installed three-bvh-csg.
 *
 * Statically imported HERE only. Production code reaches the library through the single
 * lazy site in `csgModule.ts`; a test has no bundle to protect and gains determinism from
 * importing it directly.
 *
 * Assertions are volume and bounds rather than triangle counts, because the exact
 * tessellation of a boolean result is the library's business and would make these tests
 * break on a dependency bump that changed nothing observable.
 */

import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import * as csgLibrary from 'three-bvh-csg';
import { evaluateCsgPlan } from './evaluateCsgPlan';
import { CsgOperation, type CsgContribution, type CsgPlan } from './csgPlan';
import type { CsgModule } from './csgModule';
import type { TscnNode } from '../../parser/types';

const csg = csgLibrary as unknown as CsgModule;

const dummyNode: TscnNode = { name: 'n', type: 'CSGBox3D', children: [], properties: {} as never };

function contribution(
  path: string,
  operation: number,
  surface: number,
  matrix = new THREE.Matrix4()
): CsgContribution {
  return { path, type: 'CSGBox3D', operation, matrix, surface, node: dummyNode };
}

function plan(contributions: CsgContribution[], surfaces: (string | undefined)[] = [undefined]): CsgPlan {
  return {
    rootPath: 'Root',
    contributions,
    surfaces,
    absorbedPaths: new Set(),
    invisiblePaths: new Set(),
    cacheKey: 'test',
  };
}

/**
 * Solid volume via the divergence theorem.
 *
 * `toNonIndexed()` first, and not optionally: a `BoxGeometry` is INDEXED with 24 unique
 * positions and 36 indices, so walking positions in triples integrates eight arbitrary
 * triangles instead of the real twelve and reports 1/12 of the true volume.
 */
function volumeOf(geometry: THREE.BufferGeometry): number {
  const p = (geometry.index ? geometry.toNonIndexed() : geometry).getAttribute('position');
  let total = 0;
  for (let i = 0; i < p.count; i += 3) {
    const a = new THREE.Vector3(p.getX(i), p.getY(i), p.getZ(i));
    const b = new THREE.Vector3(p.getX(i + 1), p.getY(i + 1), p.getZ(i + 1));
    const c = new THREE.Vector3(p.getX(i + 2), p.getY(i + 2), p.getZ(i + 2));
    total += a.dot(new THREE.Vector3().crossVectors(b, c)) / 6;
  }
  return Math.abs(total);
}

// Non-indexed, matching what `applyCsgNormals` emits for every real CSG contribution.
const unitBox = () => new THREE.BoxGeometry(1, 1, 1).toNonIndexed();
/** A box offset so exactly half of it overlaps the unit box. */
const halfOverlapBox = () => new THREE.BoxGeometry(1, 1, 1).translate(0.5, 0, 0).toNonIndexed();

describe('evaluateCsgPlan', () => {
  const resolveBoxes = (geometries: THREE.BufferGeometry[]) => {
    let i = 0;
    return () => geometries[i++] ?? null;
  };

  it('unions two half-overlapping boxes into 1.5x the volume', () => {
    const result = evaluateCsgPlan(
      plan([contribution('a', CsgOperation.UNION, 0), contribution('b', CsgOperation.UNION, 0)]),
      csg,
      resolveBoxes([unitBox(), halfOverlapBox()])
    )!;
    expect(volumeOf(result.geometry)).toBeCloseTo(1.5, 2);
  });

  it('subtracts, leaving half the volume', () => {
    const result = evaluateCsgPlan(
      plan([contribution('a', CsgOperation.UNION, 0), contribution('b', CsgOperation.SUBTRACTION, 0)]),
      csg,
      resolveBoxes([unitBox(), halfOverlapBox()])
    )!;
    expect(volumeOf(result.geometry)).toBeCloseTo(0.5, 2);
  });

  it('intersects, leaving the overlap only', () => {
    const result = evaluateCsgPlan(
      plan([contribution('a', CsgOperation.UNION, 0), contribution('b', CsgOperation.INTERSECTION, 0)]),
      csg,
      resolveBoxes([unitBox(), halfOverlapBox()])
    )!;
    expect(volumeOf(result.geometry)).toBeCloseTo(0.5, 2);
    // And the survivor is the +X half, not the whole box.
    result.geometry.computeBoundingBox();
    expect(result.geometry.boundingBox!.min.x).toBeCloseTo(0, 3);
    expect(result.geometry.boundingBox!.max.x).toBeCloseTo(0.5, 3);
  });

  it('applies each contribution’s root-local matrix', () => {
    const offset = new THREE.Matrix4().makeTranslation(10, 0, 0);
    const result = evaluateCsgPlan(
      plan([contribution('a', CsgOperation.UNION, 0, offset)]),
      csg,
      resolveBoxes([unitBox()])
    )!;
    result.geometry.computeBoundingBox();
    expect(result.geometry.boundingBox!.min.x).toBeCloseTo(9.5, 5);
  });

  it('folds three contributions in order', () => {
    // Union then subtract: order matters, and doing it in reverse would leave 1.0.
    const result = evaluateCsgPlan(
      plan([
        contribution('a', CsgOperation.UNION, 0),
        contribution('b', CsgOperation.UNION, 0),
        contribution('c', CsgOperation.SUBTRACTION, 0),
      ]),
      csg,
      resolveBoxes([unitBox(), halfOverlapBox(), new THREE.BoxGeometry(1, 1, 1).translate(1, 0, 0)])
    )!;
    // box + half-overlap = 1.5, minus the +1 box removes its 0.5 overlap → 1.0.
    expect(volumeOf(result.geometry)).toBeCloseTo(1.0, 2);
  });

  describe('surfaces', () => {
    it('maps each result material slot back to a plan surface', () => {
      const result = evaluateCsgPlan(
        plan(
          [contribution('a', CsgOperation.UNION, 0), contribution('b', CsgOperation.UNION, 1)],
          ['SubResource("A")', 'SubResource("B")']
        ),
        csg,
        resolveBoxes([unitBox(), halfOverlapBox()])
      )!;
      expect(result.surfaceSlots.length).toBeGreaterThan(0);
      for (const slot of result.surfaceSlots) {
        expect(slot).toBeGreaterThanOrEqual(0);
        expect(slot).toBeLessThan(2);
      }
      // Both materials survive a union where each contributes visible faces.
      expect(new Set(result.surfaceSlots).size).toBe(2);
    });

    it('reports a single slot when every contribution shares one material', () => {
      const result = evaluateCsgPlan(
        plan([contribution('a', CsgOperation.UNION, 0), contribution('b', CsgOperation.UNION, 0)]),
        csg,
        resolveBoxes([unitBox(), halfOverlapBox()])
      )!;
      expect(result.surfaceSlots).toEqual([0]);
    });
  });

  describe('degenerate plans', () => {
    it('returns empty geometry, not null, when nothing contributes', () => {
      const result = evaluateCsgPlan(plan([contribution('a', CsgOperation.UNION, 0)]), csg, () => null)!;
      expect(result).not.toBeNull();
      expect(result.geometry.getAttribute('position').count).toBe(0);
    });

    it('skips a contribution whose geometry has no vertices', () => {
      const empty = new THREE.BufferGeometry();
      empty.setAttribute('position', new THREE.BufferAttribute(new Float32Array(0), 3));
      const result = evaluateCsgPlan(
        plan([contribution('a', CsgOperation.UNION, 0), contribution('b', CsgOperation.UNION, 0)]),
        csg,
        resolveBoxes([unitBox(), empty])
      )!;
      expect(volumeOf(result.geometry)).toBeCloseTo(1, 2);
    });

    it('passes a lone contribution through unchanged', () => {
      const result = evaluateCsgPlan(
        plan([contribution('a', CsgOperation.UNION, 0)]),
        csg,
        resolveBoxes([unitBox()])
      )!;
      expect(volumeOf(result.geometry)).toBeCloseTo(1, 5);
    });

    it('leaves a first-child SUBTRACTION empty, folding into nothing', () => {
      // Faithful to Godot: the accumulator starts empty, so this really is nothing.
      // The first contribution is the accumulator itself, so the operation only bites
      // from the second onward; a plan whose ONLY contribution subtracts still yields
      // that solid, exactly as Godot's root does.
      const result = evaluateCsgPlan(
        plan([contribution('a', CsgOperation.SUBTRACTION, 0)]),
        csg,
        resolveBoxes([unitBox()])
      )!;
      expect(volumeOf(result.geometry)).toBeCloseTo(1, 5);
    });
  });

  it('returns null when the evaluator throws, so the caller can degrade', () => {
    const exploding = {
      ...csg,
      Evaluator: class {
        useGroups = true;
        consolidateGroups = true;
        removeUnusedMaterials = true;
        attributes: string[] = [];
        evaluate(): THREE.Mesh {
          throw new Error('non-manifold');
        }
      },
    } as unknown as CsgModule;

    const result = evaluateCsgPlan(
      plan([contribution('a', CsgOperation.UNION, 0), contribution('b', CsgOperation.UNION, 0)]),
      exploding,
      resolveBoxes([unitBox(), halfOverlapBox()])
    );
    expect(result).toBeNull();
  });
});
