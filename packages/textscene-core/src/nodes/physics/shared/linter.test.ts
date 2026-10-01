/**
 * The shared CollisionObject3D non-uniform-scale rule
 * (`collisionobject3d-non-uniform-scale`, collision_object_3d.cpp:744). `Linter`
 * registers nothing and `StrictTscnParser` is type-agnostic, so importing only
 * this rule isolates it from sibling slices.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Linter } from '../../../linter/Linter';
import { reportsOf } from '../../../linter/testing/tierLists';
import './linter';

const RULE = 'collisionobject3d-non-uniform-scale';

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
    expect(reportsOf(linter.lint(scene('Area3D', UNIFORM)), RULE, 'warning')).toEqual([]);
  });

  it('stays silent with no transform at all', () => {
    const content = `[gd_scene format=3]

[node name="Root" type="Node3D"]

[node name="MyArea3D" type="Area3D" parent="."]`;
    expect(reportsOf(linter.lint(content), RULE, 'warning')).toEqual([]);
  });

  // Every concrete CollisionObject3D descendant this repo registers:
  // collision_object_3d.cpp:744 reaches all of them through virtual dispatch,
  // so a family missing here is one the rule never runs on.
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
      const warnings = reportsOf(linter.lint(scene(type, NON_UNIFORM)), RULE, 'warning');
      expect(warnings).toHaveLength(1);
    });
  }

  it('leaves an unrelated Node3D alone even when non-uniformly scaled', () => {
    expect(reportsOf(linter.lint(scene('MeshInstance3D', NON_UNIFORM)), RULE, 'warning')).toEqual([]);
  });
});
