/**
 * Tests for BoneTwistDisperser3D's semantic linter rules (strict-parser format
 * checks live in linterParser.test.ts and are asserted through
 * validatorRegistry there).
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

/** One Weighted setting whose leaves are all mutually consistent. */
const WEIGHTED_SETTING = {
  setting_count: 1,
  'settings/0/root_bone_name': '"UpperArm"',
  'settings/0/root_bone': 0,
  'settings/0/end_bone_name': '"Hand"',
  'settings/0/end_bone': 2,
  'settings/0/extend_end_bone': true,
  'settings/0/end_bone_direction': 6,
  'settings/0/twist_from_rest': true,
  'settings/0/disperse_mode': 1,
  'settings/0/weight_position': 0.5,
  'settings/0/joint_count': 3,
};

/** One Custom setting carrying per-joint amounts inside its own joint_count. */
const CUSTOM_SETTING = {
  setting_count: 1,
  'settings/0/root_bone': 0,
  'settings/0/end_bone': 2,
  'settings/0/disperse_mode': 2,
  'settings/0/damping_curve': 'null',
  'settings/0/joint_count': 3,
  'settings/0/joints/0/twist_amount': 0.25,
  'settings/0/joints/1/twist_amount': 0.75,
};

describe('BoneTwistDisperser3D semantic rules', () => {
  it('warns when a settings/<i>/… index is >= setting_count', () => {
    expectDiagnostic(
      scene(
        node('BoneTwistDisperser3D', {
          setting_count: 1,
          'settings/1/twist_from_rest': true,
        })
      ),
      {
        ruleName: 'bonetwistdisperser3d-setting-index-out-of-range',
        severity: 'error',
        nodeType: 'BoneTwistDisperser3D',
        contains: ['bone_twist_disperser_3d.cpp:39', 'setting_count (1)'],
      }
    );
  });

  it('treats an absent setting_count as zero, which is its default', () => {
    // `LocalVector<BoneTwistDisperser3DSetting *> settings` starts empty
    // (bone_twist_disperser_3d.h:86), so nothing is addressable.
    expectDiagnostic(
      scene(node('BoneTwistDisperser3D', { 'settings/0/twist_from_rest': true })),
      { ruleName: 'bonetwistdisperser3d-setting-index-out-of-range', severity: 'error' }
    );
  });

  it('lists every out-of-range setting index once, in order', () => {
    const found = expectDiagnostic(
      scene(
        node('BoneTwistDisperser3D', {
          setting_count: 1,
          'settings/3/twist_from_rest': true,
          'settings/3/disperse_mode': 0,
          'settings/2/twist_from_rest': false,
        })
      ),
      { ruleName: 'bonetwistdisperser3d-setting-index-out-of-range' }
    );
    expect(found.message).toContain('index(es) 2, 3 fall outside');
  });

  it('leaves a negative setting index to the validator that already errors on it', () => {
    // Both would cite the same ERR_FAIL_INDEX_V; reporting twice is one defect
    // counted twice.
    expectNoDiagnostic(
      scene(
        node('BoneTwistDisperser3D', {
          setting_count: 1,
          'settings/-1/twist_from_rest': true,
        })
      ),
      { ruleName: 'bonetwistdisperser3d-setting-index-out-of-range' }
    );
  });

  it('warns when a joint twist_amount sits past that setting joint_count', () => {
    expectDiagnostic(
      scene(
        node('BoneTwistDisperser3D', {
          ...CUSTOM_SETTING,
          'settings/0/joints/5/twist_amount': 0.5,
        })
      ),
      {
        ruleName: 'bonetwistdisperser3d-joint-index-out-of-range',
        severity: 'error',
        nodeType: 'BoneTwistDisperser3D',
        contains: ['bone_twist_disperser_3d.cpp:502', '0/5'],
      }
    );
  });

  it('treats an absent joint_count as zero, which is its default', () => {
    // `LocalVector<DisperseJointSetting> joints` starts empty
    // (bone_twist_disperser_3d.h:69), so no joint is addressable.
    expectDiagnostic(
      scene(
        node('BoneTwistDisperser3D', {
          setting_count: 1,
          'settings/0/disperse_mode': 2,
          'settings/0/joints/0/twist_amount': 0.5,
        })
      ),
      { ruleName: 'bonetwistdisperser3d-joint-index-out-of-range', severity: 'error' }
    );
  });

  it('resolves a non-canonical setting index the way to_int does', () => {
    // `settings/00/…` addresses setting 0, because _set reads the index with a
    // bare `to_int` (bone_twist_disperser_3d.cpp:37). Its joints vector is the
    // one `settings/0/joint_count` sized, so joint 2 of 3 lands and nothing is
    // dropped. Matching the sibling on the index TEXT warned here, contradicting
    // the same to_int reasoning the validators are built on.
    expectClean(
      scene(
        node('BoneTwistDisperser3D', {
          setting_count: 1,
          'settings/0/joint_count': 3,
          'settings/00/joints/2/twist_amount': 0.5,
        })
      )
    );
  });

  it('resolves a non-canonical joint_count key onto the setting it sizes', () => {
    // The mirror image: `settings/00/joint_count` sizes setting 0's vector, so
    // a canonical joint key under it is in range too.
    expectClean(
      scene(
        node('BoneTwistDisperser3D', {
          setting_count: 1,
          'settings/00/joint_count': 3,
          'settings/0/joints/2/twist_amount': 0.5,
        })
      )
    );
  });

  it('sorts the reported pairs numerically, not lexicographically', () => {
    const found = expectDiagnostic(
      scene(
        node('BoneTwistDisperser3D', {
          setting_count: 1,
          'settings/0/joint_count': 2,
          'settings/0/joints/10/twist_amount': 0.5,
          'settings/0/joints/2/twist_amount': 0.5,
        })
      ),
      { ruleName: 'bonetwistdisperser3d-joint-index-out-of-range' }
    );
    expect(found.message).toContain('joint(s) 0/2, 0/10 (setting/joint)');
  });

  it('does not double-report joints under a setting that is already refused', () => {
    // The whole setting is dropped at :39, so its joints never reach :502.
    expectNoDiagnostic(
      scene(
        node('BoneTwistDisperser3D', {
          setting_count: 1,
          'settings/2/joints/9/twist_amount': 0.5,
        })
      ),
      { ruleName: 'bonetwistdisperser3d-joint-index-out-of-range' }
    );
  });

  it('says nothing about a malformed setting_count, which its validator owns', () => {
    expectNoDiagnostic(
      scene(
        node('BoneTwistDisperser3D', {
          setting_count: 'not-a-number',
          'settings/0/twist_from_rest': true,
        })
      ),
      { ruleName: 'bonetwistdisperser3d-setting-index-out-of-range' }
    );
  });

  it('accepts a Weighted setting inside its count', () => {
    expectClean(scene(node('BoneTwistDisperser3D', WEIGHTED_SETTING)));
  });

  it('accepts a Custom setting whose joints sit inside joint_count', () => {
    expectClean(scene(node('BoneTwistDisperser3D', CUSTOM_SETTING)));
  });

  it('leaves the committed fixture clean of rules as well as validators', () => {
    expect(lint(readFixture('unit-bone-twist-disperser-3d.tscn'))).toEqual([]);
  });
});

describe('BoneTwistDisperser3D index grammar', () => {
  it('errors on a setting written under a non-numeric index, which _set resolves', () => {
    // `_set` reads the index with a bare `path.get_slicec('/', 1).to_int()` and
    // no validity gate (bone_twist_disperser_3d.cpp:37), and `to_int` skips a
    // character it cannot use rather than stopping at it
    // (ustring.cpp:2280-2293), so `settings/x1/…` is setting 1 — past a
    // setting_count of 1, and dropped by the ERR_FAIL_INDEX_V at :39.
    expectDiagnostic(
      scene(
        node('BoneTwistDisperser3D', {
          setting_count: 1,
          'settings/x1/root_bone_name': '"UpperArm"',
        })
      ),
      {
        ruleName: 'bonetwistdisperser3d-setting-index-out-of-range',
        severity: 'error',
        contains: ['1', 'setting_count (1)'],
      }
    );
  });
});
