/**
 * Tests for CSGTorus3D strict validators (format validation).
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
  return `[gd_scene format=3]\n\n[node name="Ring" type="CSGTorus3D"]\n${body}\n`;
}

describe('CSGTorus3D strict validators', () => {
  let linter: Linter;

  beforeEach(() => {
    linter = new Linter();
  });

  it('passes the vendored witness block (csg.tscn:268)', () => {
    const content = scene(
      [
        'transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0.9, 0)',
        'operation = 2',
        'inner_radius = 0.25',
        'outer_radius = 0.4',
        'sides = 32',
        'ring_sides = 5',
      ].join('\n')
    );
    expect(errorsOf(linter.lint(content))).toEqual([]);
  });

  it('rejects a malformed transform via the inherited Node3D validator', () => {
    // Not re-declared in this slice; the Node3D base walk supplies it.
    const errors = errorsOf(linter.lint(scene('transform = Transform3D(nope)')));
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]!.message).toContain('transform');
  });

  it.each([
    // csg_shape.cpp:2101/:2112, ERR_FAIL_COND(p_sides/p_ring_sides < 3): the
    // floor is enforced.
    ['sides = 2', 'sides'],
    ['ring_sides = 2', 'ring_sides'],
    ['smooth_faces = maybe', 'smooth_faces'],
    ['material = "not-a-resource"', 'material'],
  ])('rejects %s', (line, property) => {
    const errors = errorsOf(linter.lint(scene(line)));
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.message.includes(property))).toBe(true);
  });

  it.each([
    // csg_shape.cpp:2074-2075 hint a closed 64 ceiling, but the setter never
    // checks it, so exceeding it is a warning (ADR-0032).
    ['sides = 65', 'sides'],
    ['ring_sides = 65', 'ring_sides'],
    // inner_radius/outer_radius (csg_shape.cpp:2081-2093) are bare
    // assignments; their hints (:2072-2073) are advisory only.
    ['inner_radius = -1', 'inner_radius'],
    ['outer_radius = 0', 'outer_radius'],
    // csg_shape.cpp:1040 hints the operation enum but set_operation:933-937
    // is a bare assignment.
    ['operation = 5', 'operation'],
  ])('warns (not errors) on %s', (line, property) => {
    const content = scene(line);
    expect(errorsOf(linter.lint(content))).toEqual([]);
    const warnings = warningsOf(linter.lint(content));
    expect(warnings.some((w) => w.message.includes(property))).toBe(true);
  });

  it('accepts the segment-count bounds Godot itself allows', () => {
    expect(errorsOf(linter.lint(scene('sides = 3\nring_sides = 64')))).toEqual([]);
  });
});
