/**
 * Tests for CSGMesh3D strict validators (format validation).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Linter } from '../../../../linter/Linter';
import './linterParser';

function errorsOf(diagnostics: ReturnType<Linter['lint']>) {
  return diagnostics.filter((d) => d.severity === 'error');
}

function scene(body: string): string {
  return `[gd_scene format=3]\n\n[node name="M" type="CSGMesh3D"]\n${body}\n`;
}

describe('CSGMesh3D strict validators', () => {
  let linter: Linter;

  beforeEach(() => {
    linter = new Linter();
  });

  it('passes a mesh with a material and an operation', () => {
    const content = scene(
      ['mesh = SubResource("BoxMesh_1")', 'material = SubResource("StandardMaterial3D_1")', 'operation = 2'].join('\n')
    );
    expect(errorsOf(linter.lint(content))).toEqual([]);
  });

  it('passes a CSGMesh3D with no mesh at all', () => {
    // Godot builds an empty brush rather than erroring, so neither do we.
    expect(errorsOf(linter.lint(scene('transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0)')))).toEqual([]);
  });

  it.each([
    ['mesh = "not-a-resource"', 'mesh'],
    ['material = "not-a-resource"', 'material'],
    ['operation = 5', 'operation'],
    ['flip_faces = perhaps', 'flip_faces'],
  ])('rejects %s', (line, property) => {
    const errors = errorsOf(linter.lint(scene(line)));
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.message.includes(property))).toBe(true);
  });

  it('rejects a malformed transform via the inherited Node3D validator', () => {
    const errors = errorsOf(linter.lint(scene('transform = Transform3D(nope)')));
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]!.message).toContain('transform');
  });
});
