/**
 * Tests for CSGSphere3D strict validators (format validation).
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

function scene(body: string): string {
  return `[gd_scene format=3]\n\n[node name="Sphere" type="CSGSphere3D"]\n${body}\n`;
}

describe('CSGSphere3D strict validators', () => {
  let linter: Linter;

  beforeEach(() => {
    linter = new Linter();
  });

  it('passes the witnessed CSGSphere3D (radius, segments, rings, transform, material)', () => {
    const content = scene(
      [
        'transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, -1, 1, 1)',
        'radius = 1.25',
        'radial_segments = 48',
        'rings = 24',
        'operation = 1',
      ].join('\n')
    );

    expect(errorsOf(linter.lint(content))).toEqual([]);
  });

  it('rejects a non-positive radius', () => {
    const errors = errorsOf(linter.lint(scene('radius = 0')));
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]!.message).toContain('radius');
  });

  // csg_shape.cpp:1478 refuses `<= 0` while :1470 hints a floor of 0.001, so
  // (0, 0.001) is a band Godot loads and the inspector excludes.
  it('separates the radius floor the setter refuses from the one the hint states', () => {
    expect(errorsOf(linter.lint(scene('radius = -1')))).toHaveLength(1);
    const belowHint = linter.lint(scene('radius = 0.0005'));
    expect(errorsOf(belowHint)).toEqual([]);
    expect(warningsOf(belowHint).map((w) => w.message)).toHaveLength(1);
    expect(warningsOf(belowHint)[0]!.message).toContain('0.001');
    expect(linter.lint(scene('radius = 0.001'))).toEqual([]);
  });

  it.each([
    // csg_shape.cpp:1489, `radial_segments = p_radial_segments > 4 ?
    // p_radial_segments : 4`: 1-3 are altered on load, so they are errors
    // (ADR-0032) even though the :1471 hint displays a minimum of 1.
    ['radial_segments = 3', 'radial_segments'],
    // csg_shape.cpp:1499, `rings = p_rings > 1 ? p_rings : 1`: same clamp.
    ['rings = 0', 'rings'],
  ])('rejects %s, one step under the clamp floor', (line, property) => {
    const errors = errorsOf(linter.lint(scene(line)));
    expect(errors.some((e) => e.message.includes(property))).toBe(true);
  });

  it.each([
    ['radial_segments = 4', 'radial_segments'],
    ['rings = 1', 'rings'],
  ])('accepts the endpoint %s in silence', (line, property) => {
    // Each clamp leaves its own floor untouched (`> 4` and `> 1` are false at
    // 4 and 1, so the else branch returns the same number), and 4 sits ABOVE
    // the :1471 hint's displayed minimum of 1. Checking warnings too is what
    // pins the floor's LOCATION — a drifted `min` still leaves errors empty.
    const diagnostics = linter.lint(scene(line));
    expect(errorsOf(diagnostics)).toEqual([]);
    expect(warningsOf(diagnostics).some((w) => w.message.includes(property))).toBe(false);
  });

  it.each([
    // csg_shape.cpp:1470/:1471/:1472 close all three ceilings; nothing in the
    // setters clamps the top, so the endpoint itself is silent.
    ['radius = 100.0', 'radius'],
    ['radial_segments = 100', 'radial_segments'],
    ['rings = 100', 'rings'],
  ])('accepts the hinted ceiling %s in silence', (line, property) => {
    const diagnostics = linter.lint(scene(line));
    expect(errorsOf(diagnostics)).toEqual([]);
    expect(warningsOf(diagnostics).some((w) => w.message.includes(property))).toBe(false);
  });

  it.each([
    // One step past each hinted ceiling (the hints' steps are 0.001 and 1).
    // Hint-only, so a WARNING: set_radius only ERR_FAIL_CONDs `<= 0`, and both
    // integer setters clamp their floor and leave the top alone.
    ['radius = 100.001', 'radius'],
    ['radial_segments = 101', 'radial_segments'],
    ['rings = 101', 'rings'],
  ])('warns (not errors) one step above the ceiling: %s', (line, property) => {
    const diagnostics = linter.lint(scene(line));
    expect(errorsOf(diagnostics)).toEqual([]);
    const warnings = warningsOf(diagnostics).filter((w) => w.message.includes(property));
    expect(warnings.length).toBe(1);
  });

  it('warns (not errors) on an out-of-range operation enum', () => {
    // csg_shape.cpp:1040 hints the enum but set_operation:933-937 is a bare
    // assignment, so out-of-range is a warning, not an error (ADR-0032).
    const content = scene('operation = 5');

    expect(errorsOf(linter.lint(content))).toEqual([]);
    const warnings = warningsOf(linter.lint(content));
    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings[0]!.message).toContain('operation');
  });

  it('rejects a malformed material resource reference', () => {
    const errors = errorsOf(linter.lint(scene('material = "not-a-resource"')));
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]!.message).toContain('material');
  });
});
