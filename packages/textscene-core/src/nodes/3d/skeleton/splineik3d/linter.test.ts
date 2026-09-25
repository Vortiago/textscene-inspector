/**
 * Tests for the SplineIK3D path rule (`splineik3d-setting-without-path-3d`). Driven through
 * `Linter`, which registers nothing of its own, so only this slice's rule and validators are live.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Linter } from '../../../../linter/Linter';
import './linterParser';
import './linter';

const RULE = 'splineik3d-setting-without-path-3d';

function warningsOf(diagnostics: ReturnType<Linter['lint']>) {
  return diagnostics.filter((d) => d.ruleName === RULE);
}

/** A SplineIK3D with the given property block, under a Skeleton3D. */
function scene(properties: string): string {
  return `[gd_scene format=3]

[node name="Root" type="Node3D"]

[node name="SplinePath" type="Path3D" parent="."]

[node name="Skeleton3D" type="Skeleton3D" parent="."]

[node name="MySplineIK3D" type="SplineIK3D" parent="Skeleton3D"]
${properties}`;
}

describe('SplineIK3D path rule', () => {
  let linter: Linter;

  beforeEach(() => {
    linter = new Linter();
  });

  it('accepts every setting naming a path', () => {
    const content = scene(`setting_count = 2
settings/0/path_3d = NodePath("../../SplinePath")
settings/1/path_3d = NodePath("../../SplinePath")
`);
    expect(warningsOf(linter.lint(content))).toEqual([]);
  });

  it('stays silent on a bare node, whose settings array is empty', () => {
    // `path_3d` is empty by default and Godot omits it, so a node with no
    // settings must not read as a node with a missing path.
    expect(warningsOf(linter.lint(scene('')))).toEqual([]);
    expect(warningsOf(linter.lint(scene('setting_count = 0\n')))).toEqual([]);
  });

  it('warns for a setting whose path_3d key is absent', () => {
    const content = scene(`setting_count = 1
settings/0/tilt_fade_in = 2
`);
    const warnings = warningsOf(linter.lint(content));
    expect(warnings).toHaveLength(1);
    expect(warnings[0]!.severity).toBe('warning');
    expect(warnings[0]!.message).toContain('setting 0');
  });

  it('warns for an explicitly empty NodePath, which is the same unset value', () => {
    const content = scene(`setting_count = 1
settings/0/path_3d = NodePath("")
`);
    expect(warningsOf(linter.lint(content))).toHaveLength(1);
  });

  it('reports each path-less setting separately, naming its index', () => {
    const content = scene(`setting_count = 3
settings/1/path_3d = NodePath("../../SplinePath")
`);
    const warnings = warningsOf(linter.lint(content));
    expect(warnings.map((w) => w.message.match(/setting (\d)/)?.[1])).toEqual(['0', '2']);
  });

  it('allocates nothing for a count it cannot read, leaving that to the validator', () => {
    // A negative or malformed count is the validator's diagnostic; inventing
    // settings from it here would double-report one mistake.
    expect(warningsOf(linter.lint(scene('setting_count = -2\n')))).toEqual([]);
    expect(warningsOf(linter.lint(scene('setting_count = many\n')))).toEqual([]);
  });

  it('leaves other SkeletonModifier3D types alone', () => {
    const content = `[gd_scene format=3]

[node name="Root" type="Node3D"]

[node name="MyCCDIK3D" type="CCDIK3D" parent="."]
setting_count = 1
`;
    expect(warningsOf(linter.lint(content))).toEqual([]);
  });

  it('credits a path written with a tail, which _set ignores', () => {
    // `what = path.get_slicec('/', 2)` (spline_ik_3d.cpp:38) is `path_3d`, so set_path_3d runs.
    const content = scene(`setting_count = 1
settings/0/path_3d/extra = NodePath("../../SplinePath")
`);
    expect(warningsOf(linter.lint(content))).toEqual([]);
  });
});
