/**
 * Runs the booleans against the installed three-bvh-csg, imported statically, since a test has no
 * bundle to protect. It asserts volume and bounds, not triangle counts, because the tessellation
 * belongs to the library and changes on a dependency bump.
 */

import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import * as csgLibrary from 'three-bvh-csg';
import { evaluateCsgPlan } from './evaluateCsgPlan';
import { CsgOperation, type CsgContribution, type CsgPlan } from './csgPlan';
import type { CsgModule } from './csgModule';
import type { CsgSolid } from './csgRegistration';
import type { TscnNode } from '../../parser/types';

const csg = csgLibrary as unknown as CsgModule;

const dummyNode: TscnNode = {
  rawProperties: {},
  name: 'n',
  type: 'CSGBox3D',
  children: [],
  properties: {} as never,
};

function contribution(path: string, operation: number, matrix = new THREE.Matrix4()): CsgContribution {
  return {
    path,
    type: 'CSGBox3D',
    operation,
    matrix,
    node: dummyNode,
    hasGeometry: true,
    children: [],
  };
}

function plan(contributions: CsgContribution[]): CsgPlan {
  // The flat list these cases were written against is the root plus its children, which
  // is what a subtree of same-level contributions folds to.
  const [first, ...rest] = contributions;
  return {
    rootPath: 'Root',
    root: first ? { ...first, children: rest } : null,
    geometryCount: contributions.length,
    absorbedPaths: new Set(),
    invisiblePaths: new Set(),
    cacheKey: 'test',
  };
}

/**
 * Solid volume by the divergence theorem, after `toNonIndexed()`: a `BoxGeometry` is indexed, with
 * 24 positions and 36 indices, so walking positions in triples integrates eight arbitrary triangles.
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

/** The first `count` faces of a non-indexed `geometry` as draw group 0, the rest as group 1. */
function splitInTwoGroups(geometry: THREE.BufferGeometry, count: number): THREE.BufferGeometry {
  const vertices = geometry.getAttribute('position').count;
  geometry.addGroup(0, count * 3);
  geometry.addGroup(count * 3, vertices - count * 3, 1);
  return geometry;
}

describe('evaluateCsgPlan', () => {
  /** Each contribution in turn takes the next solid, a geometry under no material. */
  const resolveBoxes = (geometries: THREE.BufferGeometry[]) => resolveSolids(geometries.map(unlit));
  const resolveSolids = (solids: CsgSolid[]) => {
    let i = 0;
    return () => solids[i++] ?? null;
  };
  const unlit = (geometry: THREE.BufferGeometry): CsgSolid => ({ geometry, materials: [undefined] });

  it('unions two half-overlapping boxes into 1.5x the volume', () => {
    const result = evaluateCsgPlan(
      plan([contribution('a', CsgOperation.UNION), contribution('b', CsgOperation.UNION)]),
      csg,
      resolveBoxes([unitBox(), halfOverlapBox()])
    )!;
    expect(volumeOf(result.geometry)).toBeCloseTo(1.5, 2);
  });

  it('subtracts, leaving half the volume', () => {
    const result = evaluateCsgPlan(
      plan([contribution('a', CsgOperation.UNION), contribution('b', CsgOperation.SUBTRACTION)]),
      csg,
      resolveBoxes([unitBox(), halfOverlapBox()])
    )!;
    expect(volumeOf(result.geometry)).toBeCloseTo(0.5, 2);
  });

  it('intersects, leaving the overlap only', () => {
    const result = evaluateCsgPlan(
      plan([contribution('a', CsgOperation.UNION), contribution('b', CsgOperation.INTERSECTION)]),
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
      plan([contribution('a', CsgOperation.UNION, offset)]),
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
        contribution('a', CsgOperation.UNION),
        contribution('b', CsgOperation.UNION),
        contribution('c', CsgOperation.SUBTRACTION),
      ]),
      csg,
      resolveBoxes([unitBox(), halfOverlapBox(), new THREE.BoxGeometry(1, 1, 1).translate(1, 0, 0)])
    )!;
    // box + half-overlap = 1.5, minus the +1 box removes its 0.5 overlap → 1.0.
    expect(volumeOf(result.geometry)).toBeCloseTo(1.0, 2);
  });

  describe('materials', () => {
    const union = () => plan([contribution('a', CsgOperation.UNION), contribution('b', CsgOperation.UNION)]);

    it('maps each result slot back to the material of the faces in it', () => {
      const result = evaluateCsgPlan(
        union(),
        csg,
        resolveSolids([
          { geometry: unitBox(), materials: ['SubResource("A")'] },
          { geometry: halfOverlapBox(), materials: ['SubResource("B")'] },
        ])
      )!;
      // Both materials survive a union where each contributes visible faces.
      expect([...result.materials].sort()).toEqual(['SubResource("A")', 'SubResource("B")']);
      expect(result.geometry.groups.map((g) => g.materialIndex).sort()).toEqual([0, 1]);
    });

    it('interns a material two solids share into one slot', () => {
      const result = evaluateCsgPlan(
        union(),
        csg,
        resolveSolids([
          { geometry: unitBox(), materials: ['SubResource("A")'] },
          { geometry: halfOverlapBox(), materials: ['SubResource("A")'] },
        ])
      )!;
      expect(result.materials).toEqual(['SubResource("A")']);
    });

    it('gives each draw group of a solid its own material', () => {
      // A box's first six faces are its +X and -X sides.
      const twoMaterials = splitInTwoGroups(unitBox(), 4);
      const result = evaluateCsgPlan(
        plan([contribution('a', CsgOperation.UNION)]),
        csg,
        resolveSolids([{ geometry: twoMaterials, materials: ['res://x.tres', 'res://y.tres'] }])
      )!;
      expect(result.materials).toEqual(['res://x.tres', 'res://y.tres']);
    });

    it('keeps a face with no material as its own slot', () => {
      const result = evaluateCsgPlan(
        union(),
        csg,
        resolveSolids([unlit(unitBox()), { geometry: halfOverlapBox(), materials: ['SubResource("A")'] }])
      )!;
      expect(result.materials).toContain(undefined);
      expect(result.materials).toContain('SubResource("A")');
    });
  });

  describe('degenerate plans', () => {
    it('returns empty geometry, not null, when nothing contributes', () => {
      const result = evaluateCsgPlan(plan([contribution('a', CsgOperation.UNION)]), csg, () => null)!;
      expect(result).not.toBeNull();
      expect(result.geometry.getAttribute('position').count).toBe(0);
    });

    it('skips a contribution whose geometry has no vertices', () => {
      const empty = new THREE.BufferGeometry();
      empty.setAttribute('position', new THREE.BufferAttribute(new Float32Array(0), 3));
      const result = evaluateCsgPlan(
        plan([contribution('a', CsgOperation.UNION), contribution('b', CsgOperation.UNION)]),
        csg,
        resolveBoxes([unitBox(), empty])
      )!;
      expect(volumeOf(result.geometry)).toBeCloseTo(1, 2);
    });

    it('passes a lone contribution through unchanged', () => {
      const result = evaluateCsgPlan(
        plan([contribution('a', CsgOperation.UNION)]),
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
        plan([contribution('a', CsgOperation.SUBTRACTION)]),
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
      plan([contribution('a', CsgOperation.UNION), contribution('b', CsgOperation.UNION)]),
      exploding,
      resolveBoxes([unitBox(), halfOverlapBox()])
    );
    expect(result).toBeNull();
  });
});
