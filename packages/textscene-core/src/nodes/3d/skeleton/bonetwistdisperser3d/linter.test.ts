/**
 * BoneTwistDisperser3D's semantic rules. linterParser.test.ts covers the format checks. It uses
 * `Linter` through testkit, not the `linter/index.ts` barrel, which imports every slice and so fails
 * on a half-written sibling.
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
  it('reports when a settings/<i>/… index is >= setting_count', () => {
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
    // Both would cite the same ERR_FAIL_INDEX_V, and reporting twice counts one defect twice.
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

  it('reports when a joint twist_amount sits past that setting joint_count', () => {
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
    // dropped.
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

  it('measures against the length a refused setting_count leaves behind, not the authored one', () => {
    // `set_setting_count` opens with `ERR_FAIL_COND(p_count < 0)`
    // (bone_twist_disperser_3d.cpp:650), so the write never lands and `settings`
    // keeps the empty length it loaded with. Naming -1 would report a size the
    // engine never held, beside the `enforced:` validator that already errored.
    const found = lint(
      scene(
        node('BoneTwistDisperser3D', {
          setting_count: -1,
          'settings/0/twist_from_rest': true,
        })
      )
    ).filter((d) => d.ruleName === 'bonetwistdisperser3d-setting-index-out-of-range');
    expect(found).toHaveLength(1);
    expect(found[0]!.message).toContain('setting_count (0)');
    expect(found[0]!.message).not.toContain('-1');
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

describe('BoneTwistDisperser3D count and index reads', () => {
  /** Every diagnostic either rule of this slice produces for `props`. */
  const ruleFindings = (props: Record<string, string | number | boolean>) =>
    lint(scene(node('BoneTwistDisperser3D', props))).filter((d) =>
      d.ruleName.startsWith('bonetwistdisperser3d-')
    );

  it('measures joints against the length a refused joint_count leaves behind', () => {
    // `set_joint_count` opens with `ERR_FAIL_COND(p_count < 0)` (bone_twist_disperser_3d.cpp:487),
    // so the joints vector keeps its empty length and joint 0 is dropped. The -1 is the
    // `enforced:` validator's own error, and the rule names no joint count at all.
    const found = ruleFindings({
      setting_count: 1,
      'settings/0/joint_count': -1,
      'settings/0/joints/0/twist_amount': 0.5,
    });
    expect(found.map((d) => d.ruleName)).toEqual(['bonetwistdisperser3d-joint-index-out-of-range']);
    expect(found[0]!.message).toContain('joint(s) 0/0 (setting/joint)');
  });

  // The issue's scene. `to_int` saturates at INT64_MAX (ustring.cpp:2283-2284), the `int` keeps -1,
  // and `ERR_FAIL_INDEX_V` (bone_twist_disperser_3d.cpp:39) refuses it, which phase 1 reports.
  it('leaves a setting index that saturates to INT64_MAX to the negative-index refusal', () => {
    const props = {
      setting_count: 1,
      'settings/0/joint_count': 1,
      'settings/99999999999999999999/joints/0/twist_amount': 0.5,
    };
    expect(ruleFindings(props)).toEqual([]);
    expect(lint(scene(node('BoneTwistDisperser3D', props))).map((d) => d.message)).toContainEqual(
      expect.stringContaining('Setting index 99999999999999999999 (stored as -1) must be non-negative')
    );
  });

  // `int which = ….to_int()` (bone_twist_disperser_3d.cpp:37) keeps the low 32 bits, so
  // `4294967296` is setting 0, whose joint_count holds joint 0.
  it('treats a setting index that wraps past 32 bits as the setting it lands on', () => {
    const props = {
      setting_count: 1,
      'settings/0/joint_count': 1,
      'settings/4294967296/joints/0/twist_amount': 0.5,
    };
    expect(ruleFindings(props)).toEqual([]);
    const errors = lint(scene(node('BoneTwistDisperser3D', props))).filter(
      (d) => d.severity === 'error'
    );
    expect(errors).toEqual([]);
  });

  it('names what Godot stores beside a wrapping joint index past its joint_count', () => {
    const found = ruleFindings({
      setting_count: 1,
      'settings/0/joint_count': 1,
      'settings/0/joints/4294967297/twist_amount': 0.5,
    });
    expect(found).toHaveLength(1);
    expect(found[0]!.message).toContain('joint(s) 0/4294967297 (stored as 0/1) (setting/joint)');
  });

  it('caps the joint pairs it names, however many fall outside', () => {
    const joints = Object.fromEntries(
      Array.from({ length: 40 }, (_, j) => [`settings/0/joints/${j + 1}/twist_amount`, 0.5])
    );
    const found = ruleFindings({ setting_count: 1, 'settings/0/joint_count': 1, ...joints });
    expect(found).toHaveLength(1);
    expect(found[0]!.message).toContain('0/32 and 8 more (setting/joint)');
  });
});

describe('BoneTwistDisperser3D index grammar', () => {
  it('errors on a setting written under a non-numeric index, which _set resolves', () => {
    // `_set` reads the index with a bare `path.get_slicec('/', 1).to_int()` and
    // no validity gate (bone_twist_disperser_3d.cpp:37), and `to_int` skips a
    // character it cannot use (ustring.cpp:2280-2293), so `settings/x1/…` is setting 1: past a
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

  it('reads a joint amount and joint_count through a tail, which _set ignores', () => {
    // `prop = path.get_slicec('/', 4)` (bone_twist_disperser_3d.cpp:67) is `twist_amount`, and
    // `what` is `joint_count` (:38, :63), so both reach their setters.
    expectDiagnostic(
      scene(
        node('BoneTwistDisperser3D', {
          setting_count: 1,
          'settings/0/joint_count/extra': 1,
          'settings/0/joints/1/twist_amount/extra': 0.5,
        })
      ),
      { ruleName: 'bonetwistdisperser3d-joint-index-out-of-range', contains: ['0/1'] }
    );
    expectNoDiagnostic(
      scene(
        node('BoneTwistDisperser3D', {
          setting_count: 1,
          'settings/0/joint_count/extra': 2,
          'settings/0/joints/1/twist_amount': 0.5,
        })
      ),
      { ruleName: 'bonetwistdisperser3d-joint-index-out-of-range' }
    );
  });
});
