/**
 * One "no shape" configuration warning for every 2D collision object
 * (collision_object_2d.cpp:588), reached through the base walk rather than one rule per family.
 */

import { describe, it } from 'vitest';
import { expectDiagnostic, expectNoDiagnostic } from '../../../../linter/testing/testkit';
import './linter';

const RULE = 'collisionobject2d-needs-collision-shape';

function scene(type: string, children = ''): string {
  return `[gd_scene format=3]

[node name="Root" type="Node2D"]

[node name="Body" type="${type}" parent="."]
${children}`;
}

describe(RULE, () => {
  it('warns on a body with no shape child', () => {
    expectDiagnostic(scene('StaticBody2D'), { ruleName: RULE, severity: 'warning', nodeType: 'StaticBody2D' });
  });

  it('reaches an area the same way', () => {
    expectDiagnostic(scene('Area2D'), { ruleName: RULE, severity: 'warning', nodeType: 'Area2D' });
  });

  it('is silent once a shape child exists', () => {
    const withShape = scene('StaticBody2D', '\n[node name="Shape" type="CollisionShape2D" parent="Body"]\n');
    expectNoDiagnostic(withShape, { ruleName: RULE });
  });
});
