/**
 * Tests for NavigationRegion2D semantic linter rules.
 *
 * NavigationRegion2D carries a single semantic concern: if a
 * `navigation_polygon` reference is provided, it must resolve to a declared
 * resource. The reference is OPTIONAL — a region with no polygon is valid
 * (Godot bakes one at runtime), so an absent reference must NOT be flagged.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Linter } from '../../../linter/Linter';
import './linterParser';
import './linter';

describe('NavigationRegion2D semantic rules', () => {
  let linter: Linter;

  beforeEach(() => {
    linter = new Linter();
  });

  it('passes when the navigation_polygon reference resolves', () => {
    const content = `[gd_scene format=3]

[ext_resource type="NavigationPolygon" path="res://nav.tres" id="1_nav"]

[node name="Region" type="NavigationRegion2D"]
navigation_polygon = ExtResource("1_nav")
`;

    expect(linter.lint(content)).toHaveLength(0);
  });

  it('errors when a navigation_polygon ExtResource reference is dangling', () => {
    const content = `[gd_scene format=3]

[node name="Region" type="NavigationRegion2D"]
navigation_polygon = ExtResource("9_missing")
`;

    const diagnostics = linter.lint(content);
    const error = diagnostics.find((d) => d.ruleName === 'valid-navigationregion2d-resources');
    expect(error).toBeDefined();
    expect(error!.severity).toBe('error');
    expect(error!.nodeType).toBe('NavigationRegion2D');
  });

  it('errors when a navigation_polygon SubResource reference is dangling', () => {
    const content = `[gd_scene format=3]

[node name="Region" type="NavigationRegion2D"]
navigation_polygon = SubResource("NavPoly_absent")
`;

    const diagnostics = linter.lint(content);
    const error = diagnostics.find((d) => d.ruleName === 'valid-navigationregion2d-resources');
    expect(error).toBeDefined();
    expect(error!.severity).toBe('error');
  });

  it('does not flag a region that omits navigation_polygon entirely', () => {
    const content = `[gd_scene format=3]

[node name="Region" type="NavigationRegion2D"]
`;

    const diagnostics = linter.lint(content);
    expect(
      diagnostics.find((d) => d.ruleName === 'valid-navigationregion2d-resources')
    ).toBeUndefined();
  });
});
