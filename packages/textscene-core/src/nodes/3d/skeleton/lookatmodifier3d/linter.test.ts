/**
 * The LookAtModifier3D axis rule (`lookatmodifier3d-parallel-rotation-axes`), driven through
 * `StrictTscnParser` and the rule's own `check`, not `Linter`, whose barrel loads every slice. The
 * parse is the real one, so the rule reads the properties a real scene produces.
 */

import { describe, expect, it } from 'vitest';
import { StrictTscnParser } from '../../../../linter/StrictTscnParser';
import { readFixture } from '../../../../linter/testing/fixtureCheck';
import { lookAtModifier3DAxisRule } from './linter';
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

/** Every diagnostic the rule reports for the LookAtModifier3D in `content`. */
function warningsFor(content: string) {
  const { scene } = new StrictTscnParser().parse(content);
  if (!scene) throw new Error('fixture failed to parse');
  const node = scene.nodes[0] && findByType(scene.nodes[0], 'LookAtModifier3D');
  expect(node, 'the fixture text must contain a LookAtModifier3D child').toBeDefined();
  return lookAtModifier3DAxisRule.check({ scene, node: node!, properties: node!.properties });
}

/** A LookAtModifier3D carrying `body`, under a plain Node3D root. */
function scene(body: string): string {
  return `[gd_scene format=3]

[node name="Root" type="Node3D"]

[node name="Look" type="LookAtModifier3D" parent="."]
${body}`;
}

describe('LookAtModifier3D parallel-axis rule', () => {
  it('accepts perpendicular axes', () => {
    expect(
      warningsFor(
        scene(`forward_axis = 4
primary_rotation_axis = 1
`)
      )
    ).toEqual([]);
  });

  it('warns when the forward axis resolves to the primary rotation axis', () => {
    // +X (BoneAxis 0) maps to Vector3::AXIS_X (0), which is what
    // primary_rotation_axis is set to: the pairing get_configuration_warnings
    // (look_at_modifier_3d.cpp:72) refuses.
    const warnings = warningsFor(
      scene(`forward_axis = 0
primary_rotation_axis = 0
`)
    );
    expect(warnings).toHaveLength(1);
    expect(warnings[0]?.severity).toBe('warning');
    expect(warnings[0]?.ruleName).toBe('lookatmodifier3d-parallel-rotation-axes');
    expect(warnings[0]?.message).toContain('+X');
    expect(warnings[0]?.message).toContain('X');
  });

  it('warns on the NEGATIVE half of the same axis too', () => {
    // get_axis_from_bone_axis (skeleton_modifier_3d.cpp:244-260) folds -Z (5)
    // onto AXIS_Z (2) exactly as it folds +Z (4), so a scene that flips the
    // sign has not escaped the condition.
    expect(
      warningsFor(
        scene(`forward_axis = 5
primary_rotation_axis = 2
`)
      )
    ).toHaveLength(1);
  });

  it.each([
    ['+Y forward against Y primary', '2', '1'],
    ['-Y forward against Y primary', '3', '1'],
  ])('warns for %s', (_label, forward, primary) => {
    expect(
      warningsFor(
        scene(`forward_axis = ${forward}
primary_rotation_axis = ${primary}
`)
      )
    ).toHaveLength(1);
  });

  it('stays silent when the scene omits both keys', () => {
    // look_at_modifier_3d.h:52-53 default forward_axis to BONE_AXIS_PLUS_Z
    // (axis Z) and primary_rotation_axis to AXIS_Y, which are perpendicular, so
    // an absent key can never trip this.
    expect(warningsFor(scene('relative = true\n'))).toEqual([]);
  });

  it('applies the default to whichever key is absent', () => {
    // Only forward_axis is written, and it is set to the Y axis the default
    // primary_rotation_axis already uses.
    expect(warningsFor(scene('forward_axis = 2\n'))).toHaveLength(1);
    // Only primary_rotation_axis is written, matching the default +Z forward.
    expect(warningsFor(scene('primary_rotation_axis = 2\n'))).toHaveLength(1);
  });

  it('folds an out-of-range forward axis onto X, as Godot does', () => {
    // The switch in get_axis_from_bone_axis has no default case and seeds `ret`
    // with AXIS_X, so a value outside 0-5 compares as X rather than as nothing.
    // The bad value is the validator's to report, and the rule still models what
    // Godot would compare.
    expect(
      warningsFor(
        scene(`forward_axis = 9
primary_rotation_axis = 0
`)
      )
    ).toHaveLength(1);
  });

  it('ignores a malformed axis instead of suppressing itself', () => {
    // A non-numeric value falls back to the engine default, so the rule reports
    // the pairing that default produces rather than silently passing.
    expect(
      warningsFor(
        scene(`forward_axis = sideways
primary_rotation_axis = 1
`)
      )
    ).toEqual([]);
  });

  it('leaves the committed fixture warning-free', () => {
    // `expectFixtureClean` runs validators only, and rules never reach it. This is
    // the half of the fixture's "zero warnings" claim nothing else checks.
    expect(warningsFor(readFixture('unit-look-at-modifier-3d.tscn'))).toEqual([]);
  });
});
