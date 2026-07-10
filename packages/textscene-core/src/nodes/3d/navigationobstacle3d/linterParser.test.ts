/**
 * Tests for NavigationObstacle3D strict validators (format validation).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Linter } from '../../../linter/Linter';
import './linterParser';

function errorsOf(diagnostics: ReturnType<Linter['lint']>) {
  return diagnostics.filter((d) => d.severity === 'error');
}

describe('NavigationObstacle3D strict validators', () => {
  let linter: Linter;

  beforeEach(() => {
    linter = new Linter();
  });

  it('passes a valid NavigationObstacle3D with a transform', () => {
    const content = `[gd_scene format=3]

[node name="X" type="NavigationObstacle3D"]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0)
`;

    expect(errorsOf(linter.lint(content))).toEqual([]);
  });

  it('rejects a malformed transform', () => {
    const content = `[gd_scene format=3]

[node name="X" type="NavigationObstacle3D"]
transform = Transform3D(nope)
`;

    const errors = errorsOf(linter.lint(content));
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]!.message).toContain('transform');
  });

  it('passes a valid NavigationObstacle3D with radius/height/avoidance properties', () => {
    const content = `[gd_scene format=3]

[node name="X" type="NavigationObstacle3D"]
radius = 1.5
height = 2.0
avoidance_enabled = true
avoidance_layers = 2
affect_navigation_mesh = true
carve_navigation_mesh = true
use_3d_avoidance = true
`;

    expect(errorsOf(linter.lint(content))).toEqual([]);
  });

  it('rejects a negative radius', () => {
    const content = `[gd_scene format=3]

[node name="X" type="NavigationObstacle3D"]
radius = -1
`;

    const errors = errorsOf(linter.lint(content));
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]!.message).toContain('radius');
  });

  it('rejects a negative height', () => {
    const content = `[gd_scene format=3]

[node name="X" type="NavigationObstacle3D"]
height = -1
`;

    const errors = errorsOf(linter.lint(content));
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]!.message).toContain('height');
  });
});
