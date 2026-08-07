/**
 * Tests for the PhysicalBone3D collision-shape rule
 * (`physicalbone3d-needs-collision-shape`), collision_object_3d.cpp:739 — the
 * reach gap this slice's `linter.ts` closes (see its docblock).
 */

import { describe, it, expect } from 'vitest';
import { node, scene, expectDiagnostic, expectNoDiagnostic } from '../../../../linter/testing/testkit';
import { readFixture } from '../../../../linter/testing/fixtureCheck';
import { Linter } from '../../../../linter/Linter';
import './linterParser';
import './linter';

const RULE = 'physicalbone3d-needs-collision-shape';

describe('PhysicalBone3D collision-shape rule', () => {
  it('warns when a PhysicalBone3D has no CollisionShape3D or CollisionPolygon3D descendant', () => {
    expectDiagnostic(scene(node('PhysicalBone3D')), { ruleName: RULE, severity: 'warning' });
  });

  it('accepts a CollisionShape3D child', () => {
    expectNoDiagnostic(
      scene(node('PhysicalBone3D', {}, { name: 'Root' }), node('CollisionShape3D', {}, { parent: '.' })),
      { ruleName: RULE }
    );
  });

  it('accepts a CollisionPolygon3D child', () => {
    expectNoDiagnostic(
      scene(node('PhysicalBone3D', {}, { name: 'Root' }), node('CollisionPolygon3D', {}, { parent: '.' })),
      { ruleName: RULE }
    );
  });

  it('accepts a shape nested deeper than a direct child', () => {
    expectNoDiagnostic(
      scene(
        node('PhysicalBone3D', {}, { name: 'Root' }),
        node('Node3D', {}, { name: 'Group', parent: '.' }),
        node('CollisionShape3D', {}, { parent: 'Group' })
      ),
      { ruleName: RULE }
    );
  });

  it('leaves the committed fixture free of this rule', () => {
    const diagnostics = new Linter().lint(readFixture('unit-physical-bone-3d.tscn'));
    expect(diagnostics.filter((d) => d.ruleName === RULE)).toEqual([]);
  });
});
