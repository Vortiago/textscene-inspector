/**
 * Tests for the PhysicalBone3D collision-shape rule
 * (`collisionobject3d-needs-collision-shape`), collision_object_3d.cpp:739 — the
 * reach gap this slice's `linter.ts` closes (see its docblock).
 */

import { describe, it, expect } from 'vitest';
import { node, scene, lint, expectDiagnostic, expectNoDiagnostic } from '../../../../linter/testing/testkit';
import { readFixture } from '../../../../linter/testing/fixtureCheck';
import { Linter } from '../../../../linter/Linter';
import './linterParser';
import './linter';
import '../shared/linter';

const RULE = 'collisionobject3d-needs-collision-shape';

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

  // `collision_shape_3d.cpp:83` attaches on
  // `Object::cast_to<CollisionObject3D>(get_parent())`, so a shape under an
  // intervening node registers with nothing and this bone's `shapes` map stays
  // empty — the state collision_object_3d.cpp:739 warns about.
  it('warns when the only shape sits deeper than a direct child', () => {
    expectDiagnostic(
      scene(
        node('PhysicalBone3D', {}, { name: 'Root' }),
        node('Node3D', {}, { name: 'Group', parent: '.' }),
        node('CollisionShape3D', {}, { parent: 'Group' })
      ),
      { ruleName: RULE, severity: 'warning' }
    );
  });

  it('leaves the committed fixture free of this rule', () => {
    const diagnostics = new Linter().lint(readFixture('unit-physical-bone-3d.tscn'));
    expect(diagnostics.filter((d) => d.ruleName === RULE)).toEqual([]);
  });
});

describe('joint_constraints/* against the JointData live when the line is applied', () => {
  // `PhysicalBone3D::_set` (physical_bone_3d.cpp:715-724) forwards a key to
  // `joint_data->_set` only `if (joint_data)`, and `joint_data` is null until
  // `set_joint_type` builds the subclass for a type in 1..5 (:1094-1113; NONE
  // and any value outside the switch leave it null). Properties apply in file
  // order, so a constraint written above `joint_type`, or under NONE, reaches
  // no JointData and `_set` returns false: a dropped write.
  it('errors on a constraint written while joint_type is still NONE', () => {
    expectDiagnostic(scene(node('PhysicalBone3D', { 'joint_constraints/bias': 0.3 })), {
      ruleName: 'physicalbone3d-joint-constraint-without-joint',
      severity: 'error',
      contains: ["'joint_constraints/bias'"],
    });
  });

  it('errors on a constraint written above joint_type, naming the order', () => {
    expectDiagnostic(
      scene(node('PhysicalBone3D', { 'joint_constraints/bias': 0.3, joint_type: 1 })),
      { ruleName: 'physicalbone3d-joint-constraint-without-joint', contains: ['file order'] }
    );
  });

  it('errors under an explicit joint_type = 0 above the line, without the order hint', () => {
    const d = expectDiagnostic(
      scene(node('PhysicalBone3D', { joint_type: 0, 'joint_constraints/bias': 0.3 })),
      { ruleName: 'physicalbone3d-joint-constraint-without-joint', severity: 'error' }
    );
    expect(d.message).not.toContain('file order');
  });

  it('accepts a Pin leaf once joint_type = 1 is above it', () => {
    expectNoDiagnostic(
      scene(node('PhysicalBone3D', { joint_type: 1, 'joint_constraints/bias': 0.3 })),
      { ruleName: 'physicalbone3d-joint-constraint-without-joint' }
    );
  });

  // Each subclass's `_set` compares the whole key against its own leaves and
  // ends `else { return false; }` (Pin :133, Cone :202, Hinge :283, Slider
  // :391, SixDOF :466/:599), so a leaf another joint type owns is dropped.
  it('errors on a Cone leaf under a Pin joint', () => {
    expectDiagnostic(
      scene(node('PhysicalBone3D', { joint_type: 1, 'joint_constraints/swing_span': 10.0 })),
      {
        ruleName: 'physicalbone3d-joint-constraint-wrong-joint-type',
        severity: 'error',
        contains: ['PinJointData'],
      }
    );
  });

  it('errors on a flat leaf under a 6DOF joint, which reads only axis-prefixed keys', () => {
    expectDiagnostic(
      scene(node('PhysicalBone3D', { joint_type: 5, 'joint_constraints/angular_limit_upper': 10.0 })),
      { ruleName: 'physicalbone3d-joint-constraint-wrong-joint-type', severity: 'error' }
    );
  });

  it('accepts an axis leaf under a 6DOF joint and a Hinge leaf under a Hinge joint', () => {
    expectNoDiagnostic(
      scene(
        node('PhysicalBone3D', { joint_type: 5, 'joint_constraints/x/angular_limit_upper': 10.0 })
      ),
      { ruleName: 'physicalbone3d-joint-constraint-wrong-joint-type' }
    );
    expectNoDiagnostic(
      scene(node('PhysicalBone3D', { joint_type: 3, 'joint_constraints/angular_limit_upper': 10.0 })),
      { ruleName: 'physicalbone3d-joint-constraint-wrong-joint-type' }
    );
  });

  it('leaves a leaf no joint type declares to phase 1', () => {
    const diagnostics = lint(scene(node('PhysicalBone3D', { joint_type: 1, 'joint_constraints/nope': 1 })));
    expect(diagnostics.filter((d) => d.ruleName.startsWith('physicalbone3d-joint-constraint'))).toEqual([]);
  });
});
