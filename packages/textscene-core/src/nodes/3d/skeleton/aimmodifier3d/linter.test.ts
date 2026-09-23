/**
 * The AimModifier3D axis rule (`aimmodifier3d-parallel-rotation-axes`), driven through
 * `StrictTscnParser` and the rule's own `check`, not `Linter`, whose barrel loads every slice. The
 * parse is the real one, so the rule reads the properties a real scene produces.
 */

import { describe, expect, it } from 'vitest';
import { StrictTscnParser } from '../../../../linter/StrictTscnParser';
import { readFixture } from '../../../../linter/testing/fixtureCheck';
import { aimModifier3DAxisRule } from './linter';
import './linterParser';
import type { TscnNode } from '../../../../parser/types';

/** Depth-first search for the first node of `type`, at any depth. */
function findByType(node: TscnNode, type: string): TscnNode | undefined {
  if (node.type === type) return node;
  for (const child of node.children) {
    const found = findByType(child, type);
    if (found) return found;
  }
  return undefined;
}

/** Every diagnostic the rule reports for the first AimModifier3D in `content`. */
function warningsFor(content: string) {
  const { scene } = new StrictTscnParser().parse(content);
  if (!scene) throw new Error("fixture failed to parse");
  const node = scene.nodes[0] && findByType(scene.nodes[0], 'AimModifier3D');
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
    // primary_rotation_axis absent, so AXIS_X. Forward -X (1) resolves to AXIS_X.
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
    // The format is the validator's to report, and the rule must not read NaN and
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

describe('AimModifier3D index grammar', () => {
  it('reads a setting written under a non-numeric index, which _set resolves', () => {
    // `_set` reads the index with `path.get_slicec('/', 1).to_int()` (aim_modifier_3d.cpp:38), and
    // `to_int` skips what it cannot use (ustring.cpp:2280-2293), so each `settings/x/…` key lands on
    // setting 0. +Z (4) maps to AXIS_Z (2), the parallel pair aim_modifier_3d.cpp:102 warns about.
    const warnings = warningsFor(
      scene(`setting_count = 1
settings/x/forward_axis = 4
settings/x/use_euler = true
settings/x/primary_rotation_axis = 2
`)
    );
    expect(warnings).toHaveLength(1);
  });
});
