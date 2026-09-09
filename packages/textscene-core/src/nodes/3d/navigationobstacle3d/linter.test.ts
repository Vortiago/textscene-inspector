/**
 * Tests for the NavigationObstacle3D carve-without-affect rule
 * (`navigationobstacle3d-carve-without-affect`).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Linter } from '../../../linter/Linter';
import './linterParser';
import './linter';

const RULE = 'navigationobstacle3d-carve-without-affect';

function reportsOf(diagnostics: ReturnType<Linter['lint']>) {
  return diagnostics.filter((d) => d.ruleName === RULE);
}

describe('NavigationObstacle3D carve-without-affect rule', () => {
  let linter: Linter;

  beforeEach(() => {
    linter = new Linter();
  });

  it('stays quiet when carve_navigation_mesh is off', () => {
    const content = `[gd_scene format=3]

[node name="Root" type="Node3D"]

[node name="Obstacle" type="NavigationObstacle3D" parent="."]
affect_navigation_mesh = false
carve_navigation_mesh = false
`;
    expect(reportsOf(linter.lint(content))).toEqual([]);
  });

  it('stays quiet when both affect_navigation_mesh and carve_navigation_mesh are enabled', () => {
    const content = `[gd_scene format=3]

[node name="Root" type="Node3D"]

[node name="Obstacle" type="NavigationObstacle3D" parent="."]
affect_navigation_mesh = true
carve_navigation_mesh = true
`;
    expect(reportsOf(linter.lint(content))).toEqual([]);
  });

  it('reports when carve_navigation_mesh is enabled but affect_navigation_mesh is explicitly false', () => {
    const content = `[gd_scene format=3]

[node name="Root" type="Node3D"]

[node name="Obstacle" type="NavigationObstacle3D" parent="."]
affect_navigation_mesh = false
carve_navigation_mesh = true
`;
    const warnings = reportsOf(linter.lint(content));
    expect(warnings).toHaveLength(1);
    expect(warnings[0]!.severity).toBe('info');
    expect(warnings[0]!.message).toContain('affect_navigation_mesh');
  });

  it('warns when carve_navigation_mesh is enabled and affect_navigation_mesh is entirely absent (defaults to false)', () => {
    const content = `[gd_scene format=3]

[node name="Root" type="Node3D"]

[node name="Obstacle" type="NavigationObstacle3D" parent="."]
carve_navigation_mesh = true
`;
    const warnings = reportsOf(linter.lint(content));
    expect(warnings).toHaveLength(1);
    expect(warnings[0]!.message).toContain('carve_navigation_mesh');
  });

  it('does not warn about nodes that are not NavigationObstacle3D', () => {
    const content = `[gd_scene format=3]

[node name="Root" type="Node"]

[node name="MeshInstance" type="MeshInstance3D" parent="."]
`;
    expect(reportsOf(linter.lint(content))).toEqual([]);
  });
});
