/**
 * Tests for NavigationRegion2D semantic linter rules.
 *
 * NavigationRegion2D carries a single semantic concern: if a
 * `navigation_polygon` reference is provided, it must resolve to a declared
 * resource. The reference is OPTIONAL — a region with no polygon is valid
 * (Godot bakes one at runtime), so an absent reference must NOT be flagged.
 */

import { describe, it } from 'vitest';
import { node, scene, expectClean, expectDiagnostic, expectNoDiagnostic } from '../../../linter/testing/testkit';
import './linterParser';
import './linter';

describe('NavigationRegion2D semantic rules', () => {
  it('passes when the navigation_polygon reference resolves', () => {
    expectClean(`[gd_scene format=3]

[ext_resource type="NavigationPolygon" path="res://nav.tres" id="1_nav"]

[node name="Region" type="NavigationRegion2D"]
navigation_polygon = ExtResource("1_nav")
`);
  });

  it('errors when a navigation_polygon ExtResource reference is dangling', () => {
    expectDiagnostic(
      scene(node('NavigationRegion2D', { navigation_polygon: 'ExtResource("9_missing")' }, { name: 'Region' })),
      { ruleName: 'valid-navigationregion2d-resources', severity: 'error', nodeType: 'NavigationRegion2D' }
    );
  });

  it('errors when a navigation_polygon SubResource reference is dangling', () => {
    expectDiagnostic(
      scene(node('NavigationRegion2D', { navigation_polygon: 'SubResource("NavPoly_absent")' }, { name: 'Region' })),
      { ruleName: 'valid-navigationregion2d-resources', severity: 'error' }
    );
  });

  it('does not flag a region that omits navigation_polygon entirely', () => {
    expectNoDiagnostic(scene(node('NavigationRegion2D', {}, { name: 'Region' })), {
      ruleName: 'valid-navigationregion2d-resources',
    });
  });
});
