/**
 * Tests for the SkeletonModifier3D parent rule (`skeletonmodifier3d-parent-not-skeleton3d`),
 * skeleton_modifier_3d.cpp:36. Driven through `Linter`, which registers nothing of its own.
 * `applicableNodeTypeMatcher` needs only the type name to match and `StrictTscnParser` is
 * type-registry-agnostic, so no descendant slice's parser is imported.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Linter } from '../../../../linter/Linter';
import { readFixture } from '../../../../linter/testing/fixtureCheck';
import './linter';

const RULE = 'skeletonmodifier3d-parent-not-skeleton3d';

function warningsOf(diagnostics: ReturnType<Linter['lint']>) {
  return diagnostics.filter((d) => d.ruleName === RULE);
}

/** A bare node of `type`, parented as given (`'.'` = child of Root, omitted = root itself). */
function scene(type: string, parent?: string): string {
  const heading =
    parent === undefined
      ? `[node name="My${type}" type="${type}"]`
      : `[node name="My${type}" type="${type}" parent="${parent}"]`;
  const root = parent === undefined ? '' : '[node name="Root" type="Node3D"]\n\n';
  return `[gd_scene format=3]\n\n${root}${heading}\n`;
}

// Every concrete SkeletonModifier3D descendant this repo registers, plus the class itself.
// skeleton_modifier_3d.cpp:36 reaches all of them through virtual dispatch, since none overrides
// get_configuration_warnings without calling the base.
const REACHED_TYPES = [
  'SkeletonModifier3D',
  'AimModifier3D',
  'BoneConstraint3D',
  'BoneTwistDisperser3D',
  'CCDIK3D',
  'ConvertTransformModifier3D',
  'CopyTransformModifier3D',
  'FABRIK3D',
  'JacobianIK3D',
  'LimitAngularVelocityModifier3D',
  'LookAtModifier3D',
  'ModifierBoneTarget3D',
  'PhysicalBoneSimulator3D',
  'RetargetModifier3D',
  'SkeletonIK3D',
  'SplineIK3D',
  'SpringBoneSimulator3D',
  'TwoBoneIK3D',
  'XRBodyModifier3D',
  'XRHandModifier3D',
];

describe('SkeletonModifier3D parent rule', () => {
  let linter: Linter;

  beforeEach(() => {
    linter = new Linter();
  });

  for (const type of REACHED_TYPES) {
    it(`warns when ${type}'s direct parent is not a Skeleton3D`, () => {
      const warnings = warningsOf(linter.lint(scene(type, '.')));
      expect(warnings).toHaveLength(1);
      expect(warnings[0]!.severity).toBe('warning');
      expect(warnings[0]!.nodeType).toBe(type);
    });

    it(`accepts ${type} directly under a Skeleton3D`, () => {
      const content = `[gd_scene format=3]

[node name="Root" type="Node3D"]

[node name="Skeleton3D" type="Skeleton3D" parent="."]

[node name="My${type}" type="${type}" parent="Skeleton3D"]
`;
      expect(warningsOf(linter.lint(content))).toEqual([]);
    });
  }

  it('warns at the scene root too — cast_to<Skeleton3D>(nullptr) is null, same as a wrong-typed parent', () => {
    const warnings = warningsOf(linter.lint(scene('SkeletonModifier3D')));
    expect(warnings).toHaveLength(1);
  });

  it('does not warn about a GRANDPARENT Skeleton3D — only the direct parent is read', () => {
    const content = `[gd_scene format=3]

[node name="Root" type="Node3D"]

[node name="Skeleton3D" type="Skeleton3D" parent="."]

[node name="Group" type="Node3D" parent="Skeleton3D"]

[node name="MyAimModifier3D" type="AimModifier3D" parent="Skeleton3D/Group"]
`;
    expect(warningsOf(linter.lint(content))).toHaveLength(1);
  });

  it('stays quiet when the parent type is unknowable (instanced, untyped)', () => {
    const content = `[gd_scene format=3]

[node name="Root" type="Node3D"]

[node name="Instanced" parent="." instance=ExtResource("1_abc")]

[node name="MyLookAtModifier3D" type="LookAtModifier3D" parent="Instanced"]
`;
    expect(warningsOf(linter.lint(content))).toEqual([]);
  });

  it('leaves an unrelated Node3D alone', () => {
    const content = `[gd_scene format=3]

[node name="Root" type="Node3D"]

[node name="Plain" type="Node3D" parent="."]
`;
    expect(warningsOf(linter.lint(content))).toEqual([]);
  });

  it('leaves the committed CCDIK3D fixture clean (already under Skeleton3D)', () => {
    expect(warningsOf(linter.lint(readFixture('unit-ccdik-3d.tscn')))).toEqual([]);
  });

  it('leaves the committed retarget-modifier fixture clean (already under Skeleton3D)', () => {
    expect(warningsOf(linter.lint(readFixture('unit-retarget-modifier-3d.tscn')))).toEqual([]);
  });
});
