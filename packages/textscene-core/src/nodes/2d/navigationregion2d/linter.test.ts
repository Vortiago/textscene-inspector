/**
 * Tests for NavigationRegion2D semantic linter rules.
 *
 * NavigationRegion2D has two semantic concerns: if a `navigation_polygon`
 * reference is provided, it must resolve to a declared resource; and if it is
 * ABSENT while the node is visible in the tree, that is itself Godot's own
 * configuration warning (navigation_region_2d.cpp:302-306) — `bake_navigation_mesh`
 * opens with `ERR_FAIL_COND_MSG(navigation_mesh.is_null(), ...)`, so Godot does
 * NOT bake one at runtime.
 */

import { describe, it } from 'vitest';
import { node, scene, expectClean, expectDiagnostic, expectNoDiagnostic } from '../../../linter/testing/testkit';
import './linterParser';
import './linter';

describe('NavigationRegion2D semantic rules', () => {
  describe('navigation_polygon reference (valid-navigationregion2d-resources)', () => {
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
  });

  describe('absent navigation_polygon while visible (navigationregion2d-requires-navigation-polygon)', () => {
    it('warns when navigation_polygon is absent and the node is visible', () => {
      expectDiagnostic(scene(node('NavigationRegion2D', {}, { name: 'Region' })), {
        ruleName: 'navigationregion2d-requires-navigation-polygon',
        severity: 'warning',
        nodeType: 'NavigationRegion2D',
      });
    });

    it('does not also raise the resource-error rule when navigation_polygon is absent', () => {
      expectNoDiagnostic(scene(node('NavigationRegion2D', {}, { name: 'Region' })), {
        ruleName: 'valid-navigationregion2d-resources',
      });
    });

    it('says nothing when the node itself is explicitly hidden', () => {
      expectNoDiagnostic(scene(node('NavigationRegion2D', { visible: false }, { name: 'Region' })), {
        ruleName: 'navigationregion2d-requires-navigation-polygon',
      });
    });

    it('says nothing when an ancestor is explicitly hidden', () => {
      expectNoDiagnostic(
        scene(
          node('Node2D', { visible: false }, { name: 'Root' }),
          node('NavigationRegion2D', {}, { name: 'Region', parent: '.' })
        ),
        { ruleName: 'navigationregion2d-requires-navigation-polygon' }
      );
    });

    it('says nothing when an ancestor is an untyped instance (visibility unknowable)', () => {
      const content = `[gd_scene load_steps=2 format=3]

[ext_resource type="PackedScene" path="res://rig.tscn" id="1"]

[node name="Rig" instance=ExtResource("1")]

[node name="Region" type="NavigationRegion2D" parent="."]
`;
      expectNoDiagnostic(content, { ruleName: 'navigationregion2d-requires-navigation-polygon' });
    });
  });
});
