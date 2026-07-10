/**
 * Tests for NavigationAgent3D strict validators (format validation).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Linter } from '../../../linter/Linter';
import './linterParser';

function errorsOf(diagnostics: ReturnType<Linter['lint']>) {
  return diagnostics.filter((d) => d.severity === 'error');
}

describe('NavigationAgent3D strict validators', () => {
  let linter: Linter;

  beforeEach(() => {
    linter = new Linter();
  });

  it('passes a valid NavigationAgent3D with a transform', () => {
    const content = `[gd_scene format=3]

[node name="X" type="NavigationAgent3D"]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0)
`;

    expect(errorsOf(linter.lint(content))).toEqual([]);
  });

  it('rejects a malformed transform', () => {
    const content = `[gd_scene format=3]

[node name="X" type="NavigationAgent3D"]
transform = Transform3D(nope)
`;

    const errors = errorsOf(linter.lint(content));
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]!.message).toContain('transform');
  });

  it('passes a valid NavigationAgent3D with avoidance/path properties', () => {
    const content = `[gd_scene format=3]

[node name="X" type="NavigationAgent3D"]
radius = 0.75
height = 1.8
avoidance_enabled = true
avoidance_layers = 2
avoidance_mask = 3
max_neighbors = 1
max_speed = 5.0
navigation_layers = 4
target_desired_distance = 1.5
path_desired_distance = 0.5
target_position = Vector3(1, 2, 3)
`;

    expect(errorsOf(linter.lint(content))).toEqual([]);
  });

  it('rejects a negative radius', () => {
    const content = `[gd_scene format=3]

[node name="X" type="NavigationAgent3D"]
radius = -1
`;

    const errors = errorsOf(linter.lint(content));
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]!.message).toContain('radius');
  });

  it('rejects a negative max_neighbors', () => {
    const content = `[gd_scene format=3]

[node name="X" type="NavigationAgent3D"]
max_neighbors = -1
`;

    const errors = errorsOf(linter.lint(content));
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]!.message).toContain('max_neighbors');
  });
});
