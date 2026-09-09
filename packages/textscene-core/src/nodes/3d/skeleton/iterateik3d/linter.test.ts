/**
 * Tests for the IterateIK3D target-node rule
 * (`iterateik3d-setting-missing-target-node`), iterate_ik_3d.cpp:162.
 *
 * Driven through `Linter`, which registers nothing of its own, so only this
 * file's rule (plus whatever `linterParser.js` a scene needs to parse clean)
 * is live — not the whole barrel, since that cannot run while sibling slices
 * are mid-write.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Linter } from '../../../../linter/Linter';
import { readFixture } from '../../../../linter/testing/fixtureCheck';
import './linter';
import './linterParser';
import '../ccdik3d/linterParser';
import '../fabrik3d/linterParser';
import '../jacobianik3d/linterParser';

const RULE = 'iterateik3d-setting-missing-target-node';

function warningsOf(diagnostics: ReturnType<Linter['lint']>) {
  return diagnostics.filter((d) => d.ruleName === RULE);
}

/** A node of `type`, under a Skeleton3D (SkeletonModifier3D's own placement rule). */
function scene(type: string, properties: string): string {
  return `[gd_scene format=3]

[node name="Root" type="Node3D"]

[node name="Target" type="Node3D" parent="."]

[node name="Skeleton3D" type="Skeleton3D" parent="."]

[node name="My${type}" type="${type}" parent="Skeleton3D"]
${properties}`;
}

// Every concrete IterateIK3D descendant this repo registers — none override
// get_configuration_warnings, so iterate_ik_3d.cpp:162 reaches all 3 via
// virtual dispatch. This is the reach assertion.
const REACHED_TYPES = ['CCDIK3D', 'FABRIK3D', 'JacobianIK3D'];

describe('IterateIK3D target-node rule', () => {
  let linter: Linter;

  beforeEach(() => {
    linter = new Linter();
  });

  it('stays clean on a bare node, whose settings array is empty', () => {
    expect(warningsOf(linter.lint(scene('CCDIK3D', '')))).toEqual([]);
    expect(warningsOf(linter.lint(scene('CCDIK3D', 'setting_count = 0\n')))).toEqual([]);
  });

  for (const type of REACHED_TYPES) {
    it(`warns on ${type} when a setting has no target_node key at all`, () => {
      const content = scene(type, 'setting_count = 1\nsettings/0/max_iterations = 5\n');
      const warnings = warningsOf(linter.lint(content));
      expect(warnings).toHaveLength(1);
      expect(warnings[0]!.severity).toBe('warning');
      expect(warnings[0]!.message).toContain('setting(s) 0');
    });
  }

  it('warns on an explicitly empty NodePath, the same unset value as absence', () => {
    const content = scene('FABRIK3D', 'setting_count = 1\nsettings/0/target_node = NodePath("")\n');
    expect(warningsOf(linter.lint(content))).toHaveLength(1);
  });

  it('accepts a setting whose target_node resolves', () => {
    const content = scene(
      'FABRIK3D',
      'setting_count = 1\nsettings/0/target_node = NodePath("../../Target")\n'
    );
    expect(warningsOf(linter.lint(content))).toEqual([]);
  });

  it('names every setting missing a target, not just the first', () => {
    const content = scene(
      'FABRIK3D',
      'setting_count = 3\nsettings/1/target_node = NodePath("../../Target")\n'
    );
    const warnings = warningsOf(linter.lint(content));
    expect(warnings).toHaveLength(1);
    expect(warnings[0]!.message).toContain('0, 2');
  });

  it('allocates nothing for a count it cannot read, leaving that to the validator', () => {
    expect(warningsOf(linter.lint(scene('CCDIK3D', 'setting_count = -2\n')))).toEqual([]);
    expect(warningsOf(linter.lint(scene('CCDIK3D', 'setting_count = many\n')))).toEqual([]);
  });

  it('leaves other SkeletonModifier3D types alone', () => {
    const content = `[gd_scene format=3]

[node name="Root" type="Node3D"]

[node name="Skeleton3D" type="Skeleton3D" parent="."]

[node name="MySkeletonModifier3D" type="SkeletonModifier3D" parent="Skeleton3D"]
`;
    expect(warningsOf(linter.lint(content))).toEqual([]);
  });

  it('leaves the committed CCDIK3D fixture clean (no settings at all)', () => {
    expect(warningsOf(linter.lint(readFixture('unit-ccdik-3d.tscn')))).toEqual([]);
  });
});

describe('IterateIK3D index grammar', () => {
  it('credits a target written under a non-numeric index, which _set resolves', () => {
    // `_set` reads the index with a bare `path.get_slicec('/', 1).to_int()` and
    // no validity gate (iterate_ik_3d.cpp:37), and `to_int` skips a character it
    // cannot use rather than stopping at it (ustring.cpp:2280-2293), so
    // `settings/x0/target_node` sets setting 0's target. Walking `0..count` and
    // reading `settings/0/target_node` found nothing and reported the setting
    // target-less.
    const content = scene('CCDIK3D', 'setting_count = 1\nsettings/x0/target_node = NodePath("../../Target")\n');
    expect(warningsOf(new Linter().lint(content))).toEqual([]);
  });
});
