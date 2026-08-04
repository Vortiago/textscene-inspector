/**
 * Tests for CSGCylinder3D strict validators (format validation).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Linter } from '../../../../linter/Linter';
import './linterParser';

function errorsOf(diagnostics: ReturnType<Linter['lint']>) {
  return diagnostics.filter((d) => d.severity === 'error');
}

function warningsOf(diagnostics: ReturnType<Linter['lint']>) {
  return diagnostics.filter((d) => d.severity === 'warning');
}

describe('CSGCylinder3D strict validators', () => {
  let linter: Linter;

  beforeEach(() => {
    linter = new Linter();
  });

  it('passes a valid CSGCylinder3D with all properties', () => {
    const content = `[gd_scene format=3]

[node name="Cylinder" type="CSGCylinder3D"]
radius = 0.5
height = 2.0
sides = 12
cone = true
operation = 2
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0)
`;

    expect(errorsOf(linter.lint(content))).toEqual([]);
  });

  it('warns (not errors) on a non-positive radius', () => {
    // csg_shape.cpp:1855-1859 (set_radius) is a bare assignment; the hint
    // (:1847) is advisory only, so this is a warning, not an error (ADR-0032).
    const content = `[gd_scene format=3]

[node name="Cylinder" type="CSGCylinder3D"]
radius = -1.0
`;

    expect(errorsOf(linter.lint(content))).toEqual([]);
    const warnings = warningsOf(linter.lint(content));
    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings[0]!.message).toContain('radius');
  });

  it('rejects sides outside the 3-64 range', () => {
    const content = `[gd_scene format=3]

[node name="Cylinder" type="CSGCylinder3D"]
sides = 2
`;

    const errors = errorsOf(linter.lint(content));
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]!.message).toContain('sides');
  });

  it('rejects a non-boolean cone flag', () => {
    const content = `[gd_scene format=3]

[node name="Cylinder" type="CSGCylinder3D"]
cone = 3
`;

    const errors = errorsOf(linter.lint(content));
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]!.message).toContain('cone');
  });
});
