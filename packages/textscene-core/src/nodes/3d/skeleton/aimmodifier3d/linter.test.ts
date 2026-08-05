/**
 * Tests for the AimModifier3D axis rule (`aimmodifier3d-parallel-rotation-axes`).
 *
 * Driven through `StrictTscnParser` and the rule's own `check`, not through
 * `Linter`: `Linter` imports the linter barrel, which loads every slice in the
 * repo and so cannot run while sibling slices are being written. The parse is
 * still the real one, so the properties the rule reads are the ones a scene
 * really produces.
 */

import { describe, expect, it } from 'vitest';
import { StrictTscnParser } from '../../../../linter/StrictTscnParser';
import { readFixture } from '../../../../linter/testing/fixtureCheck';
import { aimModifier3DAxisRule } from './linter';
import './linterParser';

/** Every diagnostic the rule reports for the first AimModifier3D in `content`. */
function warningsFor(content: string) {
  const { scene } = new StrictTscnParser().parse(content);
  const node = scene.nodes[0]?.children[0];
  expect(node?.type, 'the fixture text must contain an AimModifier3D child').toBe('AimModifier3D');
  return aimModifier3DAxisRule.check({ scene, node: node!, properties: node!.properties });
}

/** A one-setting AimModifier3D carrying `body`, under a plain Node3D root. */
function scene(body: string): string {
  return `[gd_scene format=3]

[node name="Root" type="Node3D"]

[node name="Aim" type="AimModifier3D" parent="."]
${body}`;
}

describe('AimModifier3D parallel-axis rule', () => {
  it('accepts a euler setting whose axes are perpendicular', () => {
    const warnings = warningsFor(
      scene(`setting_count = 1
settings/0/forward_axis = 4
settings/0/use_euler = true
settings/0/primary_rotation_axis = 1
`)
    );
    expect(warnings).toEqual([]);
  });

  it('warns when the forward axis resolves to the primary rotation axis', () => {
    // +Z (4) maps to AXIS_Z (2) at skeleton_modifier_3d.cpp:255.
    const warnings = warningsFor(
      scene(`setting_count = 1
settings/0/forward_axis = 4
settings/0/use_euler = true
settings/0/primary_rotation_axis = 2
`)
    );
    expect(warnings).toHaveLength(1);
    expect(warnings[0]!.severity).toBe('warning');
    expect(warnings[0]!.ruleName).toBe('aimmodifier3d-parallel-rotation-axes');
    expect(warnings[0]!.message).toContain('setting 0');
    expect(warnings[0]!.message).toContain('+Z');
  });

  it('treats a negative bone axis as the same axis Godot pairs with it', () => {
    // -Z (5) also maps to AXIS_Z: the switch pairs PLUS and MINUS of each axis
    // (skeleton_modifier_3d.cpp:255-257).
    const warnings = warningsFor(
      scene(`setting_count = 1
settings/0/forward_axis = 5
settings/0/use_euler = true
settings/0/primary_rotation_axis = 2
`)
    );
    expect(warnings).toHaveLength(1);
  });

  it('stays quiet without use_euler, where neither axis is consulted', () => {
    const warnings = warningsFor(
      scene(`setting_count = 1
settings/0/forward_axis = 4
settings/0/primary_rotation_axis = 2
`)
    );
    expect(warnings).toEqual([]);
  });

  it('stays quiet on the engine defaults, which are not parallel', () => {
    // forward_axis defaults to +Y (AXIS_Y) and primary_rotation_axis to AXIS_X
    // (aim_modifier_3d.h:40-42), so a setting that only enables euler is fine.
    const warnings = warningsFor(
      scene(`setting_count = 1
settings/0/use_euler = true
`)
    );
    expect(warnings).toEqual([]);
  });

  it('warns when only one of the two keys is written and the default matches it', () => {
    // primary_rotation_axis absent, so AXIS_X; forward -X (1) resolves to AXIS_X.
    const warnings = warningsFor(
      scene(`setting_count = 1
settings/0/forward_axis = 1
settings/0/use_euler = true
`)
    );
    expect(warnings).toHaveLength(1);
    expect(warnings[0]!.message).toContain('-X');
  });

  it('reports each offending setting separately', () => {
    const warnings = warningsFor(
      scene(`setting_count = 2
settings/0/forward_axis = 0
settings/0/use_euler = true
settings/1/forward_axis = 2
settings/1/use_euler = true
settings/1/primary_rotation_axis = 1
`)
    );
    expect(warnings.map((w) => w.message.includes('setting 0'))).toEqual([true, false]);
    expect(warnings).toHaveLength(2);
  });

  it('ignores a setting past setting_count, whose keys never load', () => {
    // aim_modifier_3d.cpp:40 refuses an index at or past settings.size().
    const warnings = warningsFor(
      scene(`setting_count = 1
settings/1/forward_axis = 0
settings/1/use_euler = true
settings/1/primary_rotation_axis = 0
`)
    );
    expect(warnings).toEqual([]);
  });

  it('ignores every setting when setting_count is absent, since none exist', () => {
    const warnings = warningsFor(
      scene(`settings/0/forward_axis = 0
settings/0/use_euler = true
settings/0/primary_rotation_axis = 0
`)
    );
    expect(warnings).toEqual([]);
  });

  it('falls back to the engine default when an axis value is malformed', () => {
    // The format is the validator's to report; the rule must not read NaN and
    // silently stop checking. Default forward +Y is not parallel to X.
    const warnings = warningsFor(
      scene(`setting_count = 1
settings/0/forward_axis = sideways
settings/0/use_euler = true
settings/0/primary_rotation_axis = 0
`)
    );
    expect(warnings).toEqual([]);
  });

  it('leaves the committed fixture alone', () => {
    // Read, not re-typed: `expectFixtureClean` runs validators only, so this is
    // the sole check that the fixture's own axis pairing stays non-parallel.
    expect(warningsFor(readFixture('unit-aim-modifier-3d.tscn'))).toEqual([]);
  });
});
