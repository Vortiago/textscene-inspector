/**
 * Godot's CSG subtree semantics, tested without evaluating a single boolean.
 *
 * The cases that matter are the ones a reasonable implementation gets wrong: root
 * detection across a non-CSG node, a combiner that contributes no solid of its own, a
 * subtraction folding into an empty accumulator, and a root's own operation being inert.
 */

import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { identityTransform3D } from '../../utils/transform';
import { buildCsgPlan, CsgOperation } from './csgPlan';
import type { TscnNode } from '../../parser/types';

const CSG_TYPES = new Set([
  'CSGBox3D',
  'CSGSphere3D',
  'CSGCylinder3D',
  'CSGTorus3D',
  'CSGPolygon3D',
  'CSGMesh3D',
  'CSGCombiner3D',
]);
const OPTS = {
  lookup: (t: string) =>
    CSG_TYPES.has(t)
      ? // Only the combiner has no solid of its own.
        { hasGeometry: t !== 'CSGCombiner3D', key: (n: TscnNode) => `${n.type}:${n.name}` }
      : null,
};

function node(
  type: string,
  name: string,
  properties: Record<string, unknown> = {},
  children: TscnNode[] = []
): TscnNode {
  return { name, type, children, properties: { name, ...properties } as never };
}

function translated(x: number, y: number, z: number) {
  return { transform: { ...identityTransform3D(), origin: { x, y, z } } };
}

describe('buildCsgPlan', () => {
  it('returns null for a node that is not a CSG shape', () => {
    expect(buildCsgPlan(node('MeshInstance3D', 'M'), 'M', OPTS)).toBeNull();
  });

  it('collects the root plus its CSG descendants in child order', () => {
    const root = node('CSGBox3D', 'Root', {}, [
      node('CSGSphere3D', 'A', { operation: CsgOperation.SUBTRACTION }),
      node('CSGSphere3D', 'B', { operation: CsgOperation.INTERSECTION }),
    ]);
    const plan = buildCsgPlan(root, 'Root', OPTS)!;
    expect(plan.contributions.map((c) => c.path)).toEqual(['Root', 'Root/A', 'Root/B']);
    expect(plan.contributions.map((c) => c.operation)).toEqual([
      CsgOperation.UNION,
      CsgOperation.SUBTRACTION,
      CsgOperation.INTERSECTION,
    ]);
  });

  it('STOPS at a non-CSG node, leaving a CSG grandchild its own root', () => {
    // Godot's parent_shape is set only for a DIRECT CSG parent, so CSGBox3D >
    // Node3D > CSGSphere3D is two independent roots. Descending through the Node3D
    // would silently swallow the sphere into the box's boolean.
    const root = node('CSGBox3D', 'Root', {}, [
      node('Node3D', 'Holder', {}, [node('CSGSphere3D', 'Deep')]),
    ]);
    const plan = buildCsgPlan(root, 'Root', OPTS)!;
    expect(plan.contributions.map((c) => c.path)).toEqual(['Root']);
    expect(plan.absorbedPaths.has('Root/Holder/Deep')).toBe(false);
  });

  it('gives a combiner no solid of its own but keeps its children', () => {
    const root = node('CSGCombiner3D', 'Comb', {}, [
      node('CSGBox3D', 'Ground'),
      node('CSGBox3D', 'Ledge'),
    ]);
    const plan = buildCsgPlan(root, 'Comb', OPTS)!;
    expect(plan.contributions.map((c) => c.path)).toEqual(['Comb/Ground', 'Comb/Ledge']);
  });

  it('composes nested transforms into root-local space', () => {
    const root = node('CSGBox3D', 'Root', translated(100, 0, 0), [
      node('CSGCombiner3D', 'Mid', translated(0, 2, 0), [
        node('CSGSphere3D', 'Leaf', translated(0, 0, 3)),
      ]),
    ]);
    const plan = buildCsgPlan(root, 'Root', OPTS)!;
    const leaf = plan.contributions.find((c) => c.path === 'Root/Mid/Leaf')!;
    const p = new THREE.Vector3().setFromMatrixPosition(leaf.matrix);
    expect(p.toArray()).toEqual([0, 2, 3]);
  });

  it('does NOT bake the root’s own transform, which the wrapper group already applies', () => {
    // Including it here would apply the root transform twice.
    const root = node('CSGBox3D', 'Root', translated(100, 0, 0));
    const plan = buildCsgPlan(root, 'Root', OPTS)!;
    expect(new THREE.Vector3().setFromMatrixPosition(plan.contributions[0]!.matrix).toArray()).toEqual([0, 0, 0]);
  });

  it('ignores the root’s own operation, which has nothing to fold into', () => {
    const root = node('CSGBox3D', 'Root', { operation: CsgOperation.SUBTRACTION });
    const plan = buildCsgPlan(root, 'Root', OPTS)!;
    expect(plan.contributions[0]!.operation).toBe(CsgOperation.UNION);
  });

  it('keeps a subtraction that is the FIRST child, which folds into nothing', () => {
    // Counter-intuitive and faithful: Godot starts from an empty accumulator, so
    // "empty minus X" is empty. Dropping the contribution instead would quietly turn
    // it into a union and draw a solid Godot does not.
    const root = node('CSGCombiner3D', 'Comb', {}, [
      node('CSGBox3D', 'First', { operation: CsgOperation.SUBTRACTION }),
    ]);
    const plan = buildCsgPlan(root, 'Comb', OPTS)!;
    expect(plan.contributions).toHaveLength(1);
    expect(plan.contributions[0]!.operation).toBe(CsgOperation.SUBTRACTION);
  });

  describe('visibility', () => {
    it('skips a child with visible = false, and its whole subtree', () => {
      const root = node('CSGCombiner3D', 'Comb', {}, [
        node('CSGBox3D', 'Shown'),
        node('CSGCombiner3D', 'Hidden', { visible: false }, [node('CSGSphere3D', 'Inner')]),
      ]);
      const plan = buildCsgPlan(root, 'Comb', OPTS)!;
      expect(plan.contributions.map((c) => c.path)).toEqual(['Comb/Shown']);
    });

    it('treats the scene-tree eye toggle exactly like visible = false', () => {
      // Godot's _get_brush() skips invisible children, so hiding one really does
      // change the boolean result rather than just hiding a mesh.
      const root = node('CSGBox3D', 'Root', {}, [node('CSGSphere3D', 'Cut', { operation: 2 })]);
      const plan = buildCsgPlan(root, 'Root', { ...OPTS, hiddenPaths: new Set(['Root/Cut']) })!;
      expect(plan.contributions.map((c) => c.path)).toEqual(['Root']);
    });
  });

  describe('surfaces', () => {
    it('interns each distinct material once, in first-seen order', () => {
      const root = node('CSGBox3D', 'Root', { materialPath: 'SubResource("A")' }, [
        node('CSGSphere3D', 'X', { materialPath: 'SubResource("B")' }),
        node('CSGSphere3D', 'Y', { materialPath: 'SubResource("A")' }),
      ]);
      const plan = buildCsgPlan(root, 'Root', OPTS)!;
      expect(plan.surfaces).toEqual(['SubResource("A")', 'SubResource("B")']);
      expect(plan.contributions.map((c) => c.surface)).toEqual([0, 1, 0]);
    });

    it('gives "no material" its own surface slot', () => {
      const root = node('CSGBox3D', 'Root', {}, [node('CSGSphere3D', 'X', { materialPath: 'SubResource("A")' })]);
      const plan = buildCsgPlan(root, 'Root', OPTS)!;
      expect(plan.surfaces).toEqual([undefined, 'SubResource("A")']);
    });
  });

  describe('cacheKey', () => {
    it('is stable across structurally-equal but distinct property objects', () => {
      // The whole point: the parser allocates fresh objects per reparse, so a key that
      // varied with identity would miss on every keystroke and re-run the booleans.
      const build = () =>
        buildCsgPlan(
          node('CSGBox3D', 'Root', translated(1, 2, 3), [node('CSGSphere3D', 'A', { operation: 2 })]),
          'Root',
          OPTS
        )!.cacheKey;
      expect(build()).toBe(build());
    });

    it('changes when an operation changes', () => {
      const withOp = (op: number) =>
        buildCsgPlan(node('CSGBox3D', 'R', {}, [node('CSGSphere3D', 'A', { operation: op })]), 'R', OPTS)!.cacheKey;
      expect(withOp(1)).not.toBe(withOp(2));
    });

    it('changes when a transform changes', () => {
      const at = (x: number) => buildCsgPlan(node('CSGBox3D', 'R', {}, [node('CSGSphere3D', 'A', translated(x, 0, 0))]), 'R', OPTS)!.cacheKey;
      expect(at(1)).not.toBe(at(2));
    });

    it('changes when a hidden path changes, since that changes the result', () => {
      const root = () => node('CSGBox3D', 'R', {}, [node('CSGSphere3D', 'A')]);
      const shown = buildCsgPlan(root(), 'R', OPTS)!.cacheKey;
      const hidden = buildCsgPlan(root(), 'R', { ...OPTS, hiddenPaths: new Set(['R/A']) })!.cacheKey;
      expect(shown).not.toBe(hidden);
    });

  });

  it('drops a contribution whose matrix is not finite', () => {
    const root = node('CSGBox3D', 'Root', {}, [
      node('CSGSphere3D', 'Bad', {
        transform: {
          basis_x: { x: NaN, y: 0, z: 0 },
          basis_y: { x: 0, y: 1, z: 0 },
          basis_z: { x: 0, y: 0, z: 1 },
          origin: { x: 0, y: 0, z: 0 },
        },
      }),
    ]);
    const plan = buildCsgPlan(root, 'Root', OPTS)!;
    expect(plan.contributions.map((c) => c.path)).toEqual(['Root']);
  });

  it('returns an empty-contribution plan rather than null for a combiner with no children', () => {
    // "This root legitimately draws nothing" is a different answer from "not a root".
    const plan = buildCsgPlan(node('CSGCombiner3D', 'Empty'), 'Empty', OPTS)!;
    expect(plan).not.toBeNull();
    expect(plan.contributions).toHaveLength(0);
  });
});
