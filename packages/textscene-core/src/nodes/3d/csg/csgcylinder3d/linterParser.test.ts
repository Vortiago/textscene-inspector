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

const sidesScene = (sides: number) =>
  `[gd_scene format=3]\n\n[node name="Cylinder" type="CSGCylinder3D"]\nsides = ${sides}\n`;

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
    // csg_shape.cpp:1855-1859 (set_radius) is a bare assignment, and the hint (:1847) is
    // advisory, so this is a warning, not an error (ADR-0032).
    const content = `[gd_scene format=3]

[node name="Cylinder" type="CSGCylinder3D"]
radius = -1.0
`;

    expect(errorsOf(linter.lint(content))).toEqual([]);
    const warnings = warningsOf(linter.lint(content));
    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings[0]!.message).toContain('radius');
  });

  // The two ends are grounded differently, so they report differently:
  // csg_shape.cpp:1876 ERR_FAIL_COND(p_sides < 3) refuses the floor, while the
  // hint (:1849) closes the ceiling at 64 with the setter assigning through.
  // Both ends are probed by location; a bound tested only at 2 admits any max.
  it('rejects sides below the enforced floor', () => {
    const errors = errorsOf(linter.lint(sidesScene(2)));
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]!.message).toContain('sides');
  });

  it('accepts sides at either end of the range, in silence', () => {
    for (const value of [3, 64]) {
      expect(errorsOf(linter.lint(sidesScene(value)))).toEqual([]);
      expect(warningsOf(linter.lint(sidesScene(value))).filter(w => w.message.includes('sides'))).toEqual(
        []
      );
    }
  });

  it('warns rather than errors one past the hinted ceiling', () => {
    expect(errorsOf(linter.lint(sidesScene(65)))).toEqual([]);
    const warnings = warningsOf(linter.lint(sidesScene(65)));
    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings[0]!.message).toContain('sides');
  });

  it('converts a numeric cone flag rather than refusing it', () => {
    const content = `[gd_scene format=3]

[node name="Cylinder" type="CSGCylinder3D"]
cone = 3
`;

    // `3` booleanizes to true (`variant_op.cpp:1120`), so the file loads and
    // the diagnostic is about the spelling Godot writes back, not a refusal.
    const found = linter.lint(content).filter((d) => d.message.includes('cone'));
    expect(found.length).toBeGreaterThan(0);
    expect(found[0]!.severity).toBe('warning');
  });
});
