/**
 * Tests for CSGPolygon3D strict validators (format validation).
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
  return `[gd_scene format=3]\n\n[node name="P" type="CSGPolygon3D"]\n${body}\n`;
}

describe('CSGPolygon3D strict validators', () => {
  let linter: Linter;

  beforeEach(() => {
    linter = new Linter();
  });

  it('passes the DEPTH witness (csg.tscn:145)', () => {
    const content = scene(
      ['polygon = PackedVector2Array(0, -1, 0, 0, 2, -1)', 'depth = 2.0'].join('\n')
    );
    expect(errorsOf(linter.lint(content))).toEqual([]);
  });

  it('passes the SPIN witness (csg.tscn:163)', () => {
    const content = scene(['mode = 1', 'spin_degrees = 90.0', 'spin_sides = 32'].join('\n'));
    expect(errorsOf(linter.lint(content))).toEqual([]);
  });

  it('passes the full PATH witness property set (csg.tscn:365)', () => {
    const content = scene(
      [
        'mode = 2',
        'path_node = NodePath("../Path3D")',
        'path_interval_type = 0',
        'path_interval = 0.1',
        'path_simplify_angle = 4.0',
        'path_rotation = 1',
        'path_rotation_accurate = false',
        'path_local = true',
        'path_continuous_u = true',
        'path_u_distance = 2.0',
        'path_joined = true',
        'smooth_faces = true',
      ].join('\n')
    );
    expect(errorsOf(linter.lint(content))).toEqual([]);
  });

  it('passes the racetrack witness, which sets path_u_distance high and calculate_tangents off', () => {
    const content = scene(
      ['mode = 2', 'path_node = NodePath("Path3D")', 'path_u_distance = 20.0', 'path_interval = 0.5'].join('\n')
    );
    expect(errorsOf(linter.lint(content))).toEqual([]);
  });

  it('accepts an odd-length polygon, which Godot truncates rather than refuses', () => {
    // variant_parser.cpp:1555 builds the array with `args.size() / 2`, integer
    // division, so the lone trailing coordinate is dropped and the scene loads.
    const errors = errorsOf(linter.lint(scene('polygon = PackedVector2Array(0, -1, 0)')));
    expect(errors).toEqual([]);
  });

  it.each([
    // csg_shape.cpp:2651, ERR_FAIL_COND(p_depth < 0.001): enforced floor.
    ['depth = 0', 'depth'],
    // csg_shape.cpp:2681, ERR_FAIL_COND(p_spin_degrees < 0.01 || > 360):
    // enforced both ends.
    ['spin_degrees = 0', 'spin_degrees'],
    ['spin_degrees = 361', 'spin_degrees'],
    // csg_shape.cpp:2692, ERR_FAIL_COND(p_spin_sides < 3): enforced floor.
    ['spin_sides = 2', 'spin_sides'],
    ['path_node = "notapath"', 'path_node'],
    ['material = "not-a-resource"', 'material'],
  ])('rejects %s', (line, property) => {
    const errors = errorsOf(linter.lint(scene(line)));
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.message.includes(property))).toBe(true);
  });

  it.each([
    // set_mode:2639-2645 is a bare assignment; the hint (:2600) is advisory.
    ['mode = 3', 'mode'],
    // set_path_rotation:2743-2748 is a bare assignment; the hint (:2608) is
    // advisory.
    ['path_rotation = 3', 'path_rotation'],
    // set_path_interval_type:2711-2714 is a bare assignment; the hint (:2605)
    // is advisory.
    ['path_interval_type = 2', 'path_interval_type'],
    // set_path_simplify_angle:2728-2732 is a bare assignment; the hint
    // (:2607) is advisory.
    ['path_simplify_angle = 181', 'path_simplify_angle'],
    // csg_shape.cpp:1040 hints the operation enum but set_operation:933-937
    // is a bare assignment.
    ['operation = 5', 'operation'],
  ])('warns (not errors) on %s', (line, property) => {
    const content = scene(line);
    expect(errorsOf(linter.lint(content))).toEqual([]);
    const warnings = warningsOf(linter.lint(content));
    expect(warnings.some((w) => w.message.includes(property))).toBe(true);
  });

  it('accepts path_u_distance = 0, which Godot allows and means no U scaling', () => {
    expect(errorsOf(linter.lint(scene('path_u_distance = 0.0')))).toEqual([]);
  });

  it('rejects a malformed transform via the inherited Node3D validator', () => {
    const errors = errorsOf(linter.lint(scene('transform = Transform3D(nope)')));
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]!.message).toContain('transform');
  });
});
