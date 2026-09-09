/**
 * Tests for TwoBoneIK3D's semantic linter rule (strict-parser format checks
 * live in linterParser.test.ts and are asserted through validatorRegistry
 * there).
 *
 * Uses `Linter` directly (via testkit), not the `linter/index.ts` barrel: that
 * barrel side-effect-imports every in-flight slice, so pulling it here would
 * fail flakily on a sibling's half-written file mid-wave.
 */

import { describe, it, expect } from 'vitest';
import {
  node,
  scene,
  expectClean,
  expectDiagnostic,
  expectNoDiagnostic,
  lint,
} from '../../../../linter/testing/testkit';
import { readFixture } from '../../../../linter/testing/fixtureCheck';
import './linterParser';
import './linter';

/** One setting whose leaves are all mutually consistent, for the accept cases. */
const VALID_SETTING = {
  setting_count: 1,
  'settings/0/target_node': 'NodePath("../Target")',
  'settings/0/pole_node': 'NodePath("../Pole")',
  'settings/0/root_bone': 0,
  'settings/0/middle_bone': 1,
  'settings/0/end_bone': 2,
  'settings/0/pole_direction': 7,
  'settings/0/pole_direction_vector': 'Vector3(0, 0, 1)',
  'settings/0/extend_end_bone': true,
  'settings/0/end_bone/direction': 6,
  'settings/0/end_bone/length': 0.1,
};

describe('TwoBoneIK3D semantic rules', () => {
  it('reports when a settings/<i>/… index is >= setting_count', () => {
    expectDiagnostic(
      scene(
        node('TwoBoneIK3D', {
          setting_count: 1,
          'settings/1/use_virtual_end': true,
        })
      ),
      {
        ruleName: 'twoboneik3d-setting-index-out-of-range',
        severity: 'error',
        nodeType: 'TwoBoneIK3D',
        contains: ['1', 'setting_count (1)'],
      }
    );
  });

  it('reports when setting_count is absent (defaults to 0) and a settings/0/… key is present', () => {
    expectDiagnostic(
      scene(
        node('TwoBoneIK3D', {
          'settings/0/use_virtual_end': true,
        })
      ),
      {
        ruleName: 'twoboneik3d-setting-index-out-of-range',
        severity: 'error',
        nodeType: 'TwoBoneIK3D',
      }
    );
  });

  it('reaches a four-segment end_bone key with the index check too', () => {
    expectDiagnostic(
      scene(
        node('TwoBoneIK3D', {
          setting_count: 1,
          'settings/4/end_bone/length': 0.25,
        })
      ),
      { ruleName: 'twoboneik3d-setting-index-out-of-range', contains: ['4'] }
    );
  });

  it('leaves a negative index to the validator rather than warning twice', () => {
    // The strict parser already errors on it (two_bone_ik_3d.cpp:39); a second
    // diagnostic for one defect is noise.
    expectNoDiagnostic(
      scene(
        node('TwoBoneIK3D', {
          setting_count: 1,
          'settings/-1/use_virtual_end': true,
        })
      ),
      { ruleName: 'twoboneik3d-setting-index-out-of-range' }
    );
  });

  it('reports when pole_direction_vector is set while pole_direction is not Custom', () => {
    expectDiagnostic(
      scene(
        node('TwoBoneIK3D', {
          setting_count: 1,
          'settings/0/pole_direction': 3,
          'settings/0/pole_direction_vector': 'Vector3(0, 0, 1)',
        })
      ),
      {
        ruleName: 'twoboneik3d-pole-direction-vector-ignored',
        severity: 'error',
        nodeType: 'TwoBoneIK3D',
        contains: ['two_bone_ik_3d.cpp:446'],
      }
    );
  });

  it('reports when pole_direction is absent, since the setting defaults to None', () => {
    expectDiagnostic(
      scene(
        node('TwoBoneIK3D', {
          setting_count: 1,
          'settings/0/pole_direction_vector': 'Vector3(0, 0, 1)',
        })
      ),
      { ruleName: 'twoboneik3d-pole-direction-vector-ignored', severity: 'error' }
    );
  });

  it('resolves the sibling by NUMBER, so a padded index finds its own pole_direction', () => {
    // `_set` reads the index with a bare `to_int` (two_bone_ik_3d.cpp:37), so
    // `settings/00/…` and `settings/0/…` are the SAME setting and Godot applies
    // the Custom direction to this vector. Matching on index TEXT instead made
    // the lookup miss, read the direction as None, and warn about a write the
    // engine honours.
    expectNoDiagnostic(
      scene(
        node('TwoBoneIK3D', {
          setting_count: 1,
          'settings/0/pole_direction': 7,
          'settings/00/pole_direction_vector': 'Vector3(0, 0, 1)',
        })
      ),
      { ruleName: 'twoboneik3d-pole-direction-vector-ignored' }
    );
  });

  it('resolves a PLUS-signed index too, which is_valid_int also accepts', () => {
    // The sign class must match the sibling regexes: `settings/+0/…` is a legal
    // spelling, and admitting it in one regex but not the other files the key
    // under an index its sibling cannot find, warning about a write Godot honours.
    expectNoDiagnostic(
      scene(
        node('TwoBoneIK3D', {
          setting_count: 1,
          'settings/+0/pole_direction': 7,
          'settings/+0/pole_direction_vector': 'Vector3(0, 0, 1)',
        })
      ),
      { ruleName: 'twoboneik3d-pole-direction-vector-ignored' }
    );
  });

  it('still reports on a padded index when the direction really is not Custom', () => {
    expectDiagnostic(
      scene(
        node('TwoBoneIK3D', {
          setting_count: 1,
          'settings/0/pole_direction': 3,
          'settings/00/pole_direction_vector': 'Vector3(0, 0, 1)',
        })
      ),
      { ruleName: 'twoboneik3d-pole-direction-vector-ignored', severity: 'error' }
    );
  });

  it('stays quiet when pole_direction is Custom', () => {
    expectNoDiagnostic(scene(node('TwoBoneIK3D', VALID_SETTING)), {
      ruleName: 'twoboneik3d-pole-direction-vector-ignored',
    });
  });

  it('matches each vector against its OWN sibling, not the first setting', () => {
    // Setting 0 is Custom and setting 1 is not, so exactly one index is named.
    const diagnostic = expectDiagnostic(
      scene(
        node('TwoBoneIK3D', {
          setting_count: 2,
          'settings/0/pole_direction': 7,
          'settings/0/pole_direction_vector': 'Vector3(0, 0, 1)',
          'settings/1/pole_direction': 0,
          'settings/1/pole_direction_vector': 'Vector3(0, 1, 0)',
        })
      ),
      { ruleName: 'twoboneik3d-pole-direction-vector-ignored' }
    );
    expect(diagnostic.message).toContain('setting(s) 1 ');
  });

  it('warns once when a setting has no target_node at all (key absent)', () => {
    const diagnostic = expectDiagnostic(
      scene(node('TwoBoneIK3D', { setting_count: 1, 'settings/0/root_bone': 0 })),
      { ruleName: 'twoboneik3d-setting-missing-target-node', severity: 'warning' }
    );
    expect(diagnostic.message).toContain('setting(s) 0');
  });

  it('still warns when a stray NEGATIVE index carries the only target', () => {
    // `unsatisfiedIndices` documents that `satisfied` is already restricted to
    // `0..count`. A negative index counted as satisfied inflated `satisfied.size`
    // and cancelled the warning for setting 0, which really has no target —
    // and Godot refuses the negative write outright (`two_bone_ik_3d.cpp:39`).
    const diagnostic = expectDiagnostic(
      scene(
        node('TwoBoneIK3D', {
          setting_count: 1,
          'settings/-1/target_node': 'NodePath("../Root")',
        })
      ),
      { ruleName: 'twoboneik3d-setting-missing-target-node', severity: 'warning' }
    );
    expect(diagnostic.message).toContain('setting(s) 0');
  });

  it('warns on an explicitly empty NodePath, the same unset value as absence', () => {
    expectDiagnostic(
      scene(node('TwoBoneIK3D', { setting_count: 1, 'settings/0/target_node': 'NodePath("")' })),
      { ruleName: 'twoboneik3d-setting-missing-target-node' }
    );
  });

  it('names every setting missing a target, not just the first', () => {
    const diagnostic = expectDiagnostic(
      scene(
        node('TwoBoneIK3D', {
          setting_count: 3,
          'settings/1/target_node': 'NodePath("../Target")',
        })
      ),
      { ruleName: 'twoboneik3d-setting-missing-target-node' }
    );
    expect(diagnostic.message).toContain('0, 2');
  });

  it('emits ONE diagnostic, never a second "pole target" one — Godot\'s second loop is a copy-paste bug that never reads pole_node', () => {
    const diagnostics = lint(
      scene(
        node('TwoBoneIK3D', {
          setting_count: 1,
          // pole_node is present and non-empty; only target_node is missing.
          'settings/0/pole_node': 'NodePath("../Pole")',
        })
      )
    );
    const missingTargetWarnings = diagnostics.filter(
      (d) => d.ruleName === 'twoboneik3d-setting-missing-target-node'
    );
    expect(missingTargetWarnings).toHaveLength(1);
  });

  it('stays quiet when target_node resolves for every setting in range', () => {
    expectNoDiagnostic(scene(node('TwoBoneIK3D', VALID_SETTING)), {
      ruleName: 'twoboneik3d-setting-missing-target-node',
    });
  });

  it('does not double-report a setting already out of range', () => {
    // Index 1 is both out of range AND would otherwise read as target-less;
    // only the out-of-range diagnostic should name it.
    const diagnostics = lint(
      scene(node('TwoBoneIK3D', { setting_count: 1, 'settings/1/target_node': 'NodePath("../Target")' }))
    );
    const missingTargetWarning = diagnostics.find(
      (d) => d.ruleName === 'twoboneik3d-setting-missing-target-node'
    );
    // Setting 0 (the only one IN range) has no target_node key, so it still warns.
    expect(missingTargetWarning?.message).toContain('setting(s) 0');
  });

  it('stays clean with setting_count set and no settings/<i>/… keys at all', () => {
    expectClean(scene(node('TwoBoneIK3D', { setting_count: 0 })));
  });

  it('stays clean on a fully populated, self-consistent setting', () => {
    expectClean(scene(node('TwoBoneIK3D', VALID_SETTING)));
  });

  it('leaves the committed fixture free of rule diagnostics', () => {
    // `expectFixtureClean` runs StrictTscnParser only, so the fixture's
    // rule-cleanliness has to be asserted here or nowhere.
    const diagnostics = lint(readFixture('unit-two-bone-ik-3d.tscn'));
    expect(diagnostics).toEqual([]);
  });
});

describe('TwoBoneIK3D index grammar', () => {
  it('credits a target written under a non-numeric index, which _set resolves', () => {
    // `_set` reads the index with a bare `path.get_slicec('/', 1).to_int()` and
    // no validity gate (two_bone_ik_3d.cpp:37), and `to_int` skips what it
    // cannot use (ustring.cpp:2280-2293), so `settings/x0/target_node` is
    // setting 0's target.
    expectNoDiagnostic(
      scene(
        node('TwoBoneIK3D', {
          setting_count: 1,
          'settings/x0/target_node': 'NodePath("../Target")',
        })
      ),
      { ruleName: 'twoboneik3d-setting-missing-target-node' }
    );
  });
});
