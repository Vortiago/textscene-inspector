/**
 * One "no shape" configuration warning for every 3D collision object
 * (collision_object_3d.cpp:739), reached through the base walk rather than one rule per family.
 */

import { describe, it } from 'vitest';
import { expectDiagnostic, expectNoDiagnostic } from '../../../../linter/testing/testkit';
import './linter';

const RULE = 'collisionobject3d-needs-collision-shape';

function scene(type: string, children = ''): string {
  return `[gd_scene format=3]

[node name="Root" type="Node3D"]

[node name="Body" type="${type}" parent="."]
${children}`;
}

describe(RULE, () => {
  it('warns on a body with no shape child', () => {
    expectDiagnostic(scene('StaticBody3D'), { ruleName: RULE, severity: 'warning', nodeType: 'StaticBody3D' });
  });

  it('reaches an area the same way', () => {
    expectDiagnostic(scene('Area3D'), { ruleName: RULE, severity: 'warning', nodeType: 'Area3D' });
  });

  it('is silent once a shape child exists', () => {
    const withShape = scene('StaticBody3D', '\n[node name="Shape" type="CollisionShape3D" parent="Body"]\n');
    expectNoDiagnostic(withShape, { ruleName: RULE });
  });
});
