/**
 * Tests for NavigationRegion3D semantic linter rules.
 *
 * NavigationRegion3D carries a single semantic concern: if a
 * `navigation_mesh` reference is provided, it must resolve to a declared
 * resource. The reference is OPTIONAL — a region with no mesh is valid, so an
 * absent reference must NOT be flagged.
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
        ruleName: 'valid-navigationregion3d-resources',
        severity: 'error',
        nodeType: 'NavigationRegion3D',
      }
    );
  });

  it('errors when a navigation_mesh SubResource reference is dangling', () => {
    expectDiagnostic(
      scene(node('NavigationRegion3D', { navigation_mesh: 'SubResource("NavMesh_absent")' }, { name: 'Region' })),
      {
        ruleName: 'valid-navigationregion3d-resources',
        severity: 'error',
      }
    );
  });

  it('does not flag a region that omits navigation_mesh entirely', () => {
    expectNoDiagnostic(scene(node('NavigationRegion3D', {}, { name: 'Region' })), {
      ruleName: 'valid-navigationregion3d-resources',
    });
  });
});
