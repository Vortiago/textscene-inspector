/**
 * Tests for SpringBoneSimulator3D's semantic linter rules. linterParser.test.ts asserts the format
 * checks through `validatorRegistry`. Uses `Linter` directly (through testkit), not the
 * `linter/index.ts` barrel, which imports every slice. This file owns the fixture's rule
 * cleanliness: `expectFixtureClean` runs `StrictTscnParser`, which never reaches a rule.
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

/** One shared-mode chain whose leaves are all mutually consistent. */
const SHARED_SETTING = {
  setting_count: 1,
  'settings/0/root_bone_name': '"Bone0"',
  'settings/0/root_bone': 0,
  'settings/0/end_bone_name': '"Bone3"',
  'settings/0/end_bone': 3,
  'settings/0/individual_config': false,
  'settings/0/rotation_axis': 3,
  'settings/0/radius/value': 0.02,
  'settings/0/radius/damping_curve': 'null',
  'settings/0/stiffness/value': 1.0,
  'settings/0/drag/value': 0.4,
  'settings/0/gravity/value': 0.0,
  'settings/0/gravity/direction': 'Vector3(0, -1, 0)',
  'settings/0/joints/0/bone_name': '"Bone0"',
  'settings/0/joints/0/bone': 0,
};

/** The same chain in individual mode, with the per-joint block instead. */
const INDIVIDUAL_SETTING = {
  setting_count: 1,
  'settings/0/root_bone_name': '"Bone0"',
  'settings/0/individual_config': true,
  'settings/0/joint_count': 1,
  'settings/0/joints/0/rotation_axis': 3,
  'settings/0/joints/0/radius': 0.1,
  'settings/0/joints/0/stiffness': 1.0,
  'settings/0/joints/0/drag': 0.0,
  'settings/0/joints/0/gravity': 0.0,
  'settings/0/joints/0/gravity_direction': 'Vector3(0, -1, 0)',
};

describe('SpringBoneSimulator3D semantic rules', () => {
  describe('setting index against setting_count', () => {
    it('reports when a settings/<i>/… index is >= setting_count', () => {
      expectDiagnostic(
        scene(
          node('SpringBoneSimulator3D', {
            setting_count: 1,
            'settings/1/individual_config': false,
          })
        ),
        {
          ruleName: 'springbonesimulator3d-setting-index-out-of-range',
          severity: 'error',
          nodeType: 'SpringBoneSimulator3D',
          contains: ['1', 'setting_count (1)', 'spring_bone_simulator_3d.cpp:44'],
        }
      );
    });

    it('reports when setting_count is absent, since settings starts empty', () => {
      expectDiagnostic(
        scene(node('SpringBoneSimulator3D', { 'settings/0/individual_config': false })),
        { ruleName: 'springbonesimulator3d-setting-index-out-of-range', severity: 'error' }
      );
    });

    it('reaches a five-segment joints key with the index check too', () => {
      expectDiagnostic(
        scene(
          node('SpringBoneSimulator3D', {
            setting_count: 1,
            'settings/4/joints/0/radius': 0.1,
          })
        ),
        { ruleName: 'springbonesimulator3d-setting-index-out-of-range', contains: ['4'] }
      );
    });

    it('leaves a negative index to the validator rather than warning twice', () => {
      // The strict parser already errors on it (spring_bone_simulator_3d.cpp:44);
      // a second diagnostic for one defect is noise.
      expectNoDiagnostic(
        scene(
          node('SpringBoneSimulator3D', {
            setting_count: 1,
            'settings/-1/individual_config': false,
          })
        ),
        { ruleName: 'springbonesimulator3d-setting-index-out-of-range' }
      );
    });
  });

  describe('the two config modes', () => {
    it('reports when the shared block is set while individual_config is true', () => {
      expectDiagnostic(
        scene(
          node('SpringBoneSimulator3D', {
            ...INDIVIDUAL_SETTING,
            'settings/0/stiffness/value': 2.5,
          })
        ),
        {
          ruleName: 'springbonesimulator3d-shared-config-ignored',
          severity: 'error',
          nodeType: 'SpringBoneSimulator3D',
          contains: ['spring_bone_simulator_3d.cpp:644'],
        }
      );
    });

    it('reaches the damping curve beside the value, as the engine test does', () => {
      // `_validate_dynamic_prop` matches on the segment below the index, so
      // `radius/damping_curve` is hidden with `radius/value`.
      expectDiagnostic(
        scene(
          node('SpringBoneSimulator3D', {
            ...INDIVIDUAL_SETTING,
            'settings/0/radius/damping_curve': 'null',
          })
        ),
        { ruleName: 'springbonesimulator3d-shared-config-ignored' }
      );
    });

    it('reports when a joint is tuned while individual_config is false', () => {
      expectDiagnostic(
        scene(
          node('SpringBoneSimulator3D', {
            ...SHARED_SETTING,
            'settings/0/joints/0/stiffness': 2.5,
          })
        ),
        {
          ruleName: 'springbonesimulator3d-joint-config-ignored',
          severity: 'error',
          contains: ['spring_bone_simulator_3d.cpp:914'],
        }
      );
    });

    it('exempts joints/<j>/bone and bone_name, which Godot writes in that mode', () => {
      expectNoDiagnostic(scene(node('SpringBoneSimulator3D', SHARED_SETTING)), {
        ruleName: 'springbonesimulator3d-joint-config-ignored',
      });
    });

    it('treats an absent individual_config as false, its C++ default', () => {
      // spring_bone_simulator_3d.h:130. So a bare shared block is fine and a
      // bare joint tunable is not.
      expectNoDiagnostic(
        scene(
          node('SpringBoneSimulator3D', {
            setting_count: 1,
            'settings/0/stiffness/value': 2.5,
          })
        ),
        { ruleName: 'springbonesimulator3d-shared-config-ignored' }
      );
      expectDiagnostic(
        scene(
          node('SpringBoneSimulator3D', {
            setting_count: 1,
            'settings/0/joints/0/stiffness': 2.5,
          })
        ),
        { ruleName: 'springbonesimulator3d-joint-config-ignored' }
      );
    });

    it('matches each block against its OWN sibling, not the first setting', () => {
      const diagnostic = expectDiagnostic(
        scene(
          node('SpringBoneSimulator3D', {
            setting_count: 2,
            'settings/0/individual_config': false,
            'settings/0/stiffness/value': 2.5,
            'settings/1/individual_config': true,
            'settings/1/stiffness/value': 2.5,
          })
        ),
        { ruleName: 'springbonesimulator3d-shared-config-ignored' }
      );
      expect(diagnostic.message).toContain('setting(s) 1 ');
    });
  });

  describe('the two collision lists', () => {
    it('reports on an explicit list while enable_all_child_collisions is true', () => {
      expectDiagnostic(
        scene(
          node('SpringBoneSimulator3D', {
            setting_count: 1,
            'settings/0/enable_all_child_collisions': true,
            'settings/0/collision_count': 1,
            'settings/0/collisions/0': 'NodePath("Sphere")',
          })
        ),
        {
          ruleName: 'springbonesimulator3d-collision-list-ignored',
          severity: 'error',
          contains: ['spring_bone_simulator_3d.cpp:1150-1152'],
        }
      );
    });

    it('warns on the same list when the flag is absent, since it defaults to true', () => {
      // spring_bone_simulator_3d.h:145.
      expectDiagnostic(
        scene(
          node('SpringBoneSimulator3D', {
            setting_count: 1,
            'settings/0/collisions/0': 'NodePath("Sphere")',
          })
        ),
        { ruleName: 'springbonesimulator3d-collision-list-ignored' }
      );
    });

    it('warns on an exclude list while the flag is false', () => {
      expectDiagnostic(
        scene(
          node('SpringBoneSimulator3D', {
            setting_count: 1,
            'settings/0/enable_all_child_collisions': false,
            'settings/0/exclude_collision_count': 1,
            'settings/0/exclude_collisions/0': 'NodePath("Sphere")',
          })
        ),
        {
          ruleName: 'springbonesimulator3d-collision-list-ignored',
          contains: ['spring_bone_simulator_3d.cpp:1094-1096'],
        }
      );
    });

    it('stays quiet on whichever list the flag makes live', () => {
      expectNoDiagnostic(
        scene(
          node('SpringBoneSimulator3D', {
            setting_count: 1,
            'settings/0/enable_all_child_collisions': false,
            'settings/0/collision_count': 1,
            'settings/0/collisions/0': 'NodePath("Sphere")',
          })
        ),
        { ruleName: 'springbonesimulator3d-collision-list-ignored' }
      );
      expectNoDiagnostic(
        scene(
          node('SpringBoneSimulator3D', {
            setting_count: 1,
            'settings/0/exclude_collision_count': 1,
            'settings/0/exclude_collisions/0': 'NodePath("Sphere")',
          })
        ),
        { ruleName: 'springbonesimulator3d-collision-list-ignored' }
      );
    });
  });

  it('stays clean with setting_count set and no settings/<i>/… keys at all', () => {
    expectClean(scene(node('SpringBoneSimulator3D', { setting_count: 0 })));
  });

  it('stays clean on a self-consistent chain in either mode', () => {
    expectClean(scene(node('SpringBoneSimulator3D', SHARED_SETTING)));
    expectClean(scene(node('SpringBoneSimulator3D', INDIVIDUAL_SETTING)));
  });

  it('leaves the committed fixture free of rule diagnostics', () => {
    // `expectFixtureClean` runs StrictTscnParser only, so the fixture's
    // rule-cleanliness has to be asserted here or nowhere.
    const diagnostics = lint(readFixture('unit-spring-bone-simulator-3d.tscn'));
    expect(diagnostics).toEqual([]);
  });
});

describe('SpringBoneSimulator3D index grammar', () => {
  it('reads individual_config from the setting the engine resolves, not the index text', () => {
    // `_set` reads the index with a bare `path.get_slicec('/', 1).to_int()`
    // (spring_bone_simulator_3d.cpp:42), so `settings/00/…` and `settings/0/…` are one setting. The
    // shared radius below is written while that setting is individual, and `set_radius` returns
    // before assigning (:644).
    expectDiagnostic(
      scene(
        node('SpringBoneSimulator3D', {
          setting_count: 1,
          'settings/0/individual_config': true,
          'settings/00/radius/value': 0.5,
        })
      ),
      { ruleName: 'springbonesimulator3d-shared-config-ignored', severity: 'error' }
    );
  });
});
