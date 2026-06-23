/**
 * Tests for CSGSphere3D strict validators (format validation).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Linter } from '../../../../linter/Linter';
import './linterParser';

function errorsOf(diagnostics: ReturnType<Linter['lint']>) {
  return diagnostics.filter((d) => d.severity === 'error');
}

describe('CSGSphere3D strict validators', () => {
  let linter: Linter;

  beforeEach(() => {
    linter = new Linter();
  });

  it('passes the witnessed CSGSphere3D (radius, segments, rings, transform, material)', () => {
    const content = `[gd_scene format=3]

[node name="Union" type="CSGSphere3D"]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, -1, 1, 1)
radius = 1.25
radial_segments = 48
rings = 24
operation = 1
`;

    expect(errorsOf(linter.lint(content))).toEqual([]);
  });

  it('rejects a non-positive radius', () => {
    const content = `[gd_scene format=3]

[node name="Sphere" type="CSGSphere3D"]
radius = 0
`;

    const errors = errorsOf(linter.lint(content));
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]!.message).toContain('radius');
  });

  it('rejects an out-of-range operation enum', () => {
    const content = `[gd_scene format=3]

[node name="Sphere" type="CSGSphere3D"]
operation = 5
`;

    const errors = errorsOf(linter.lint(content));
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]!.message).toContain('operation');
  });

  it('rejects a malformed material resource reference', () => {
    const content = `[gd_scene format=3]

[node name="Sphere" type="CSGSphere3D"]
material = "not-a-resource"
`;

    const errors = errorsOf(linter.lint(content));
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]!.message).toContain('material');
  });
});
