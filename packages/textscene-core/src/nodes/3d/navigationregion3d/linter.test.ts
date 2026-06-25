/**
 * Tests for NavigationRegion3D semantic linter rules.
 *
 * NavigationRegion3D carries a single semantic concern: if a
 * `navigation_mesh` reference is provided, it must resolve to a declared
 * resource. The reference is OPTIONAL — a region with no mesh is valid, so an
 * absent reference must NOT be flagged.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Linter } from '../../../linter/Linter';
import './linterParser';
import './linter';

describe('NavigationRegion3D semantic rules', () => {
  let linter: Linter;

  beforeEach(() => {
    linter = new Linter();
  });

  it('passes when the navigation_mesh reference resolves', () => {
    const content = `[gd_scene format=3]

[ext_resource type="NavigationMesh" path="res://nav.tres" id="1_nav"]

[node name="Region" type="NavigationRegion3D"]
navigation_mesh = ExtResource("1_nav")
`;

    expect(linter.lint(content)).toHaveLength(0);
  });

  it('errors when a navigation_mesh ExtResource reference is dangling', () => {
    const content = `[gd_scene format=3]

[node name="Region" type="NavigationRegion3D"]
navigation_mesh = ExtResource("9_missing")
`;

    const diagnostics = linter.lint(content);
    const error = diagnostics.find((d) => d.ruleName === 'valid-navigationregion3d-resources');
    expect(error).toBeDefined();
    expect(error!.severity).toBe('error');
    expect(error!.nodeType).toBe('NavigationRegion3D');
  });

  it('errors when a navigation_mesh SubResource reference is dangling', () => {
    const content = `[gd_scene format=3]

[node name="Region" type="NavigationRegion3D"]
navigation_mesh = SubResource("NavMesh_absent")
`;

    const diagnostics = linter.lint(content);
    const error = diagnostics.find((d) => d.ruleName === 'valid-navigationregion3d-resources');
    expect(error).toBeDefined();
    expect(error!.severity).toBe('error');
  });

  it('does not flag a region that omits navigation_mesh entirely', () => {
    const content = `[gd_scene format=3]

[node name="Region" type="NavigationRegion3D"]
`;

    const diagnostics = linter.lint(content);
    expect(
      diagnostics.find((d) => d.ruleName === 'valid-navigationregion3d-resources')
    ).toBeUndefined();
  });
});
