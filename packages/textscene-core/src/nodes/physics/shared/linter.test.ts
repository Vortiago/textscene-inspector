/**
 * Tests for the shared CollisionObject3D non-uniform-scale rule
 * (`collisionobject3d-non-uniform-scale`), collision_object_3d.cpp:744.
 *
 * Driven through `Linter`, which registers nothing of its own and does not
 * consult `nodeRegistry` to parse (`StrictTscnParser` is type-agnostic), so
 * importing only this rule is enough to isolate it from sibling slices being
 * written concurrently.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Linter } from '../../../linter/Linter';
import './linter';

const RULE = 'collisionobject3d-non-uniform-scale';

function warningsOf(diagnostics: ReturnType<Linter['lint']>) {
  return diagnostics.filter((d) => d.ruleName === RULE);
}

/** A bare node of `type`, under a plain Node3D root, with the given transform. */
function scene(type: string, transform: string): string {
  return `[gd_scene format=3]

[node name="Root" type="Node3D"]

[node name="My${type}" type="${type}" parent="."]
transform = ${transform}`;
}

const UNIFORM = 'Transform3D(2, 0, 0, 0, 2, 0, 0, 0, 2, 0, 0, 0)';
const NON_UNIFORM = 'Transform3D(2, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0)';

describe('CollisionObject3D non-uniform-scale rule', () => {
  let linter: Linter;

  beforeEach(() => {
    linter = new Linter();
  });

  it('stays silent on a uniform scale', () => {
    expect(warningsOf(linter.lint(scene('Area3D', UNIFORM)))).toEqual([]);
  });

  it('stays silent with no transform at all', () => {
    const content = `[gd_scene format=3]

[node name="Root" type="Node3D"]

[node name="MyArea3D" type="Area3D" parent="."]`;
    expect(warningsOf(linter.lint(content))).toEqual([]);
  });

  // Every concrete CollisionObject3D descendant this repo registers —
  // collision_object_3d.cpp:744 reaches all of them via virtual dispatch, and
  // this is the reach assertion: a family missing here is a family the rule
  // silently never runs on.
  const reachedTypes = [
    'Area3D',
    'StaticBody3D',
    'AnimatableBody3D',
    'CharacterBody3D',
    'PhysicalBone3D',
    'RigidBody3D',
    'VehicleBody3D',
  ];

  for (const type of reachedTypes) {
    it(`warns on ${type}'s own non-uniform scale`, () => {
      const warnings = warningsOf(linter.lint(scene(type, NON_UNIFORM)));
      expect(warnings).toHaveLength(1);
      expect(warnings[0]!.severity).toBe('warning');
    });
  }

  it('leaves an unrelated Node3D alone even when non-uniformly scaled', () => {
    expect(warningsOf(linter.lint(scene('MeshInstance3D', NON_UNIFORM)))).toEqual([]);
  });
});
