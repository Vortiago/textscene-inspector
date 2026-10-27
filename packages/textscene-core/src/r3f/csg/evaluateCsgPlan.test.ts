/**
 * Runs the booleans against the installed three-bvh-csg, imported statically, since a test has no
 * bundle to protect. It asserts volume and bounds, not triangle counts, because the tessellation
 * belongs to the library and changes on a dependency bump.
 */

import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import * as csgLibrary from 'three-bvh-csg';
import { evaluateCsgPlan } from './evaluateCsgPlan';
import { type CsgContribution, type CsgPlan } from './csgPlan';
import { CsgOperation } from '../../godot/scene/csg';
import type { CsgModule } from './csgModule';
import type { CsgSolid } from './csgRegistration';
import { enclosedVolume } from './testing/brushVolume';
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

/** The volume of a closed brush, whichever way it winds. */
function volumeOf(geometry: THREE.BufferGeometry): number {
  return Math.abs(enclosedVolume(geometry));
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
  const closedSolid = (geometry: THREE.BufferGeometry, materials: CsgSolid['materials']): CsgSolid => ({
    geometry,
    materials,
    isClosed: true,
  });
  const unlit = (geometry: THREE.BufferGeometry): CsgSolid => closedSolid(geometry, [undefined]);

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
          closedSolid(unitBox(), ['SubResource("A")']),
          closedSolid(halfOverlapBox(), ['SubResource("B")']),
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
          closedSolid(unitBox(), ['SubResource("A")']),
          closedSolid(halfOverlapBox(), ['SubResource("A")']),
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
        resolveSolids([closedSolid(twoMaterials, ['res://x.tres', 'res://y.tres'])])
      )!;
      expect(result.materials).toEqual(['res://x.tres', 'res://y.tres']);
    });

    it('keeps a face with no material as its own slot', () => {
      const result = evaluateCsgPlan(
        union(),
        csg,
        resolveSolids([unlit(unitBox()), closedSolid(halfOverlapBox(), ['SubResource("A")'])])
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

  describe('an empty brush', () => {
    const unit = () => unlit(unitBox());
    const open = (): CsgSolid => ({ ...unlit(unitBox()), isClosed: false });
    const separateBox = () => new THREE.BoxGeometry(1, 1, 1).translate(5, 0, 0).toNonIndexed();
    const separate = () => unlit(separateBox());
    const openSeparate = (): CsgSolid => ({ ...unlit(separateBox()), isClosed: false });

    /** The contribution `operation` names, with the `children` folded into it first. */
    const node = (operation: number, children: CsgContribution[] = [], hasGeometry = true) => ({
      ...contribution('n', operation),
      hasGeometry,
      children,
    });
    const planOf = (root: CsgContribution): CsgPlan => ({ ...plan([]), root, geometryCount: 2 });
    const volumeAfter = (root: CsgContribution, solids: CsgSolid[]): number =>
      volumeOf(evaluateCsgPlan(planOf(root), csg, resolveSolids(solids))!.geometry);

    it('draws nothing for an open root', () => {
      expect(volumeAfter(node(CsgOperation.UNION), [open()])).toBe(0);
    });

    it('empties an open node whatever its closed children', () => {
      const root = node(CsgOperation.UNION, [node(CsgOperation.UNION)]);

      expect(volumeAfter(root, [open(), unit()])).toBe(0);
    });

    it('adds nothing to a union when an open child joins a closed root', () => {
      const root = node(CsgOperation.UNION, [node(CsgOperation.UNION)]);

      expect(volumeAfter(root, [unit(), openSeparate()])).toBeCloseTo(1, 5);
    });

    it('removes nothing from a subtraction when an open child subtracts from a closed root', () => {
      const root = node(CsgOperation.UNION, [node(CsgOperation.SUBTRACTION)]);

      expect(volumeAfter(root, [unit(), open()])).toBeCloseTo(1, 5);
    });

    it('empties an intersection when an open child intersects a closed root', () => {
      const root = node(CsgOperation.UNION, [node(CsgOperation.INTERSECTION)]);

      expect(volumeAfter(root, [unit(), open()])).toBe(0);
    });

    it('keeps the closed children of an open child out of its parent', () => {
      const openChild = node(CsgOperation.UNION, [node(CsgOperation.UNION)]);
      const root = node(CsgOperation.UNION, [openChild]);

      expect(volumeAfter(root, [unit(), open(), separate()])).toBeCloseTo(1, 5);
    });

    it('empties an intersection when a child builds no solid', () => {
      const root = node(CsgOperation.UNION, [node(CsgOperation.INTERSECTION)]);

      expect(volumeAfter(root, [unit()])).toBe(0);
    });

    it('folds on from nothing after an intersection that leaves no faces', () => {
      const root = node(CsgOperation.UNION, [node(CsgOperation.INTERSECTION), node(CsgOperation.UNION)]);

      expect(volumeAfter(root, [unit(), separate(), unit()])).toBeCloseTo(1, 5);
    });

    it('starts a combiner empty, so a first subtraction leaves nothing to remove from', () => {
      const combiner = node(
        CsgOperation.UNION,
        [node(CsgOperation.SUBTRACTION), node(CsgOperation.UNION)],
        false
      );

      expect(volumeAfter(combiner, [unit(), separate()])).toBeCloseTo(1, 5);
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
