/**
 * Tests for NavigationRegion3D semantic linter rules.
 *
 * Two concerns, the same pair its 2D sibling carries: a `navigation_mesh`
 * reference must resolve, and an ABSENT one is Godot's own configuration
 * warning (navigation_region_3d.cpp:255-259) whenever the region is visible in
 * the tree — `bake_navigation_mesh` opens with
 * `ERR_FAIL_COND_MSG(navigation_mesh.is_null(), ...)`, so nothing bakes one at
 * runtime.
 */

import { describe, it } from 'vitest';
import {
  node,
  scene,
  expectClean,
  expectDiagnostic,
  expectNoDiagnostic,
} from '../../../linter/testing/testkit';
import './linterParser';
import './linter';

describe('NavigationRegion3D semantic rules', () => {
  it('passes when the navigation_mesh reference resolves', () => {
    expectClean(
      scene(
        '[ext_resource type="NavigationMesh" path="res://nav.tres" id="1_nav"]',
        node('NavigationRegion3D', { navigation_mesh: 'ExtResource("1_nav")' }, { name: 'Region' })
      )
    );
  });

  it('errors when a navigation_mesh ExtResource reference is dangling', () => {
    expectDiagnostic(
      scene(node('NavigationRegion3D', { navigation_mesh: 'ExtResource("9_missing")' }, { name: 'Region' })),
      {
        ruleName: 'dangling-resource-reference',
        severity: 'error',
        nodeType: 'NavigationRegion3D',
      }
    );
  });

  it('errors when a navigation_mesh SubResource reference is dangling', () => {
    expectDiagnostic(
      scene(node('NavigationRegion3D', { navigation_mesh: 'SubResource("NavMesh_absent")' }, { name: 'Region' })),
      {
        ruleName: 'dangling-resource-reference',
        severity: 'error',
      }
    );
  });

  it('does not flag a region that omits navigation_mesh entirely as a dangling reference', () => {
    expectNoDiagnostic(scene(node('NavigationRegion3D', {}, { name: 'Region' })), {
      ruleName: 'dangling-resource-reference',
    });
  });

  describe('absent navigation_mesh while visible (navigationregion3d-requires-navigation-mesh)', () => {
    it('warns when navigation_mesh is absent and the node is visible', () => {
      expectDiagnostic(scene(node('NavigationRegion3D', {}, { name: 'Region' })), {
        ruleName: 'navigationregion3d-requires-navigation-mesh',
        severity: 'warning',
        nodeType: 'NavigationRegion3D',
      });
    });

    it('says nothing when the node itself is explicitly hidden', () => {
      expectNoDiagnostic(scene(node('NavigationRegion3D', { visible: false }, { name: 'Region' })), {
        ruleName: 'navigationregion3d-requires-navigation-mesh',
      });
    });

    it('says nothing when a Node3D ancestor is hidden', () => {
      expectNoDiagnostic(
        scene(
          node('Node3D', { visible: false }, { name: 'Root' }),
          node('NavigationRegion3D', {}, { name: 'Region', parent: '.' })
        ),
        { ruleName: 'navigationregion3d-requires-navigation-mesh' }
      );
    });

    it('still warns when a plain Node breaks the Node3D chain below the hidden ancestor', () => {
      expectDiagnostic(
        scene(
          node('Node3D', { visible: false }, { name: 'Root' }),
          node('Node', {}, { name: 'Plain', parent: '.' }),
          node('NavigationRegion3D', {}, { name: 'Region', parent: 'Plain' })
        ),
        { ruleName: 'navigationregion3d-requires-navigation-mesh', severity: 'warning' }
      );
    });

    it('says nothing when an ancestor is an untyped instance (visibility unknowable)', () => {
      const content = `[gd_scene load_steps=2 format=3]

[ext_resource type="PackedScene" path="res://level.tscn" id="1"]

[node name="Level" instance=ExtResource("1")]

[node name="Region" type="NavigationRegion3D" parent="."]
`;
      expectNoDiagnostic(content, { ruleName: 'navigationregion3d-requires-navigation-mesh' });
    });
  });
});
