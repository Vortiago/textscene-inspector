/**
 * Tests for the NavigationLink3D position rule
 * (`navigationlink3d-start-position-equals-end-position`).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Linter } from '../../../linter/Linter';
import { readFixture } from '../../../linter/testing/fixtureCheck';
// Both ancestor rules reach NavigationLink3D (Node's all-nodes rule, and
// Node3D's type-family matcher), so the fixture's "no diagnostics" claim
// below is only honest with them loaded too.
import '../../node/linter';
import '../../base/node3d/linter';
import './linterParser';
import './linter';

const RULE = 'navigationlink3d-start-position-equals-end-position';

function warningsOf(diagnostics: ReturnType<Linter['lint']>) {
  return diagnostics.filter((d) => d.ruleName === RULE);
}

function scene(properties: string): string {
  return `[gd_scene format=3]

[node name="Root" type="Node3D"]

[node name="Link" type="NavigationLink3D" parent="."]
${properties}`;
}

describe('NavigationLink3D position rule', () => {
  let linter: Linter;

  beforeEach(() => {
    linter = new Linter();
  });

  it('leaves the committed fixture with no diagnostic at all', () => {
    // The fixture's "zero errors AND zero warnings" claim on the rule side.
    // `expectFixtureClean` in linterParser.test.ts runs validators only, so it
    // cannot see this rule firing.
    expect(linter.lint(readFixture('unit-navigation-link-3d.tscn'))).toEqual([]);
  });

  it('stays quiet when start and end are distinct points', () => {
    expect(
      warningsOf(linter.lint(scene('start_position = Vector3(0, 0, 0)\nend_position = Vector3(2, 0, 0)\n')))
    ).toEqual([]);
  });

  it('warns when start and end are the same point', () => {
    const warnings = warningsOf(
      linter.lint(scene('start_position = Vector3(1, 2, 3)\nend_position = Vector3(1, 2, 3)\n'))
    );
    expect(warnings).toHaveLength(1);
    expect(warnings[0]!.severity).toBe('warning');
    expect(warnings[0]!.nodeName).toBe('Link');
  });

  it('stays quiet on a bare node with neither position written', () => {
    // Both default to the same Vector3(0, 0, 0) (doc/classes/NavigationLink3D.xml),
    // but neither was authored, so there is nothing to contradict — same call
    // SpringBoneCollisionCapsule3D makes for its own absent-by-default properties.
    expect(warningsOf(linter.lint(scene('')))).toEqual([]);
  });

  it('warns when only end_position is written, leaving start_position at its zero default', () => {
    expect(warningsOf(linter.lint(scene('end_position = Vector3(0, 0, 0)\n')))).toHaveLength(1);
  });

  it('stays quiet when only end_position moves it off the shared default', () => {
    expect(warningsOf(linter.lint(scene('end_position = Vector3(3, 0, 0)\n')))).toEqual([]);
  });

  it('treats near-equal points within tolerance as equal, matching Math::is_equal_approx', () => {
    // CMP_EPSILON = 1e-5; a component difference of 1e-6 is well inside it.
    expect(
      warningsOf(
        linter.lint(
          scene('start_position = Vector3(1, 1, 1)\nend_position = Vector3(1.000001, 1, 1)\n')
        )
      )
    ).toHaveLength(1);
  });

  it('stays quiet on a component difference outside tolerance', () => {
    expect(
      warningsOf(
        linter.lint(scene('start_position = Vector3(1, 1, 1)\nend_position = Vector3(1.01, 1, 1)\n'))
      )
    ).toEqual([]);
  });

  it('warns when both ends sit at the same positive infinity, since exact equality is checked first', () => {
    // Math::is_equal_approx checks `p_left == p_right` before the tolerance
    // math, so two infinities of the same sign compare equal.
    expect(
      warningsOf(linter.lint(scene('start_position = Vector3(inf, 0, 0)\nend_position = Vector3(inf, 0, 0)\n')))
    ).toHaveLength(1);
  });

  it('stays quiet on nan, which trips no comparison', () => {
    expect(
      warningsOf(linter.lint(scene('start_position = Vector3(nan, 0, 0)\nend_position = Vector3(nan, 0, 0)\n')))
    ).toEqual([]);
  });

  it('ignores an unreadable value rather than guessing at it', () => {
    expect(
      warningsOf(linter.lint(scene('start_position = "not-a-vector"\nend_position = Vector3(0, 0, 0)\n')))
    ).toEqual([]);
  });
});
