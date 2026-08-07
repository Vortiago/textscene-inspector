/**
 * Tests for the OpenXRRenderModel parent-type rule
 * (`openxrrendermodel-parent-not-origin-or-manager`).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Linter } from '../../../../linter/Linter';
import { readFixture } from '../../../../linter/testing/fixtureCheck';
import './linterParser';
import './linter';

const PARENT_RULE = 'openxrrendermodel-parent-not-origin-or-manager';

function ruleDiagnostics(diagnostics: ReturnType<Linter['lint']>) {
  return diagnostics.filter((d) => d.ruleName === PARENT_RULE);
}

describe('OpenXRRenderModel parent-type rule', () => {
  let linter: Linter;

  beforeEach(() => {
    linter = new Linter();
  });

  it('accepts a render model parented to an XROrigin3D', () => {
    const content = `[gd_scene format=3]

[node name="XROrigin3D" type="XROrigin3D"]

[node name="RenderModel" type="OpenXRRenderModel" parent="."]
`;
    expect(ruleDiagnostics(linter.lint(content))).toEqual([]);
  });

  it('accepts a render model parented to an OpenXRRenderModelManager', () => {
    const content = `[gd_scene format=3]

[node name="Manager" type="OpenXRRenderModelManager"]

[node name="RenderModel" type="OpenXRRenderModel" parent="."]
`;
    expect(ruleDiagnostics(linter.lint(content))).toEqual([]);
  });

  it('warns for a render model under any other typed parent', () => {
    const content = `[gd_scene format=3]

[node name="Root" type="Node3D"]

[node name="RenderModel" type="OpenXRRenderModel" parent="."]
`;
    const found = ruleDiagnostics(linter.lint(content));
    expect(found).toHaveLength(1);
    expect(found[0]!.ruleName).toBe(PARENT_RULE);
    expect(found[0]!.severity).toBe('warning');
    expect(found[0]!.message).toContain('Node3D');
  });

  it('warns for a render model used as the scene root', () => {
    const content = `[gd_scene format=3]

[node name="RenderModel" type="OpenXRRenderModel"]
`;
    const found = ruleDiagnostics(linter.lint(content));
    expect(found).toHaveLength(1);
    expect(found[0]!.message).toContain('scene root');
  });

  it('stays quiet when the parent is an untyped instance whose type it cannot know', () => {
    const content = `[gd_scene load_steps=2 format=3]

[ext_resource type="PackedScene" path="res://rig.tscn" id="1"]

[node name="Root" type="Node3D"]

[node name="Rig" parent="." instance=ExtResource("1")]

[node name="RenderModel" type="OpenXRRenderModel" parent="Rig"]
`;
    expect(ruleDiagnostics(linter.lint(content))).toEqual([]);
  });

  it('leaves its own fixture clean', () => {
    // Whole-file check of the "zero errors and zero warnings" claim, for the
    // rule half; the validator half lives in linterParser.test.ts.
    const content = readFixture('unit-open-xr-render-model.tscn');
    expect(ruleDiagnostics(linter.lint(content))).toEqual([]);
  });
});
