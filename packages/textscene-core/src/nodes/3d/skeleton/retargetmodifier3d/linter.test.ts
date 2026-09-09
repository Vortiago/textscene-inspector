/**
 * Tests for the RetargetModifier3D child-skeleton rule
 * (`retargetmodifier3d-no-child-skeleton`).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Linter } from '../../../../linter/Linter';
import { readFixture } from '../../../../linter/testing/fixtureCheck';
import './linterParser';
import './linter';

const RULE = 'retargetmodifier3d-no-child-skeleton';

function warningsOf(diagnostics: ReturnType<Linter['lint']>) {
  return diagnostics.filter((d) => d.ruleName === RULE);
}

/** A source skeleton with the modifier under it, and whatever children follow. */
function scene(children: string): string {
  return `[gd_scene format=3]

[node name="Root" type="Node3D"]

[node name="Skeleton3D" type="Skeleton3D" parent="."]

[node name="Retarget" type="RetargetModifier3D" parent="Skeleton3D"]
${children}`;
}

describe('RetargetModifier3D child-skeleton rule', () => {
  let linter: Linter;

  beforeEach(() => {
    linter = new Linter();
  });

  it('accepts a modifier with a direct child Skeleton3D', () => {
    const content = scene(`
[node name="Target" type="Skeleton3D" parent="Skeleton3D/Retarget"]
`);
    expect(warningsOf(linter.lint(content))).toEqual([]);
  });

  it('warns when the modifier has no children at all', () => {
    const warnings = warningsOf(linter.lint(scene('')));
    expect(warnings).toHaveLength(1);
    expect(warnings[0]!.severity).toBe('warning');
    expect(warnings[0]!.nodeName).toBe('Retarget');
    expect(warnings[0]!.message).toContain('Skeleton3D');
  });

  it('warns when every child is something other than a Skeleton3D', () => {
    const content = scene(`
[node name="Marker" type="Marker3D" parent="Skeleton3D/Retarget"]
`);
    expect(warningsOf(linter.lint(content))).toHaveLength(1);
  });

  it('warns when the only Skeleton3D is a grandchild', () => {
    // _update_child_skeletons walks get_child(i) alone
    // (retarget_modifier_3d.cpp:178-187), so a skeleton one level deeper is
    // never collected and the node stays inert.
    const content = scene(`
[node name="Holder" type="Node3D" parent="Skeleton3D/Retarget"]

[node name="Target" type="Skeleton3D" parent="Skeleton3D/Retarget/Holder"]
`);
    expect(warningsOf(linter.lint(content))).toHaveLength(1);
  });

  it('stays quiet when a child is an untyped instance whose type it cannot know', () => {
    const content = `[gd_scene load_steps=2 format=3]

[ext_resource type="PackedScene" path="res://target.tscn" id="1"]

[node name="Root" type="Node3D"]

[node name="Skeleton3D" type="Skeleton3D" parent="."]

[node name="Retarget" type="RetargetModifier3D" parent="Skeleton3D"]

[node name="Target" parent="Skeleton3D/Retarget" instance=ExtResource("1")]
`;
    expect(warningsOf(linter.lint(content))).toEqual([]);
  });

  it('leaves the slice fixture clean', () => {
    // `expectFixtureClean` runs StrictTscnParser, which is validators only, so
    // the fixture's "zero warnings" claim is unproven against a RULE until it
    // goes through the Linter. Only this slice's registrations are imported, so
    // an empty list means nothing this slice ships rejects the file.
    expect(linter.lint(readFixture('unit-retarget-modifier-3d.tscn'))).toEqual([]);
  });

  it('does not warn about nodes that are not RetargetModifier3D', () => {
    const content = `[gd_scene format=3]

[node name="Root" type="Node3D"]

[node name="Skeleton3D" type="Skeleton3D" parent="."]
`;
    expect(warningsOf(linter.lint(content))).toEqual([]);
  });
});
