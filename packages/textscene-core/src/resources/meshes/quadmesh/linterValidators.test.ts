/**
 * Tests for what a QuadMesh sub_resource validates — all of it inherited.
 *
 * QuadMesh declares no property of its own: `size` and `center_offset` are
 * PlaneMesh's, `flip_faces` and `material` are PrimitiveMesh's. It used to
 * carry its own copies of three of them, which is a shadow that drifts, so the
 * cases below now ride the resource base-walk and are what proves it reaches a
 * leaf two hops down.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Linter } from '../../../linter/Linter';
// The FULL linter barrel, so these cases also guard the wiring: if
// linter/index.ts drops a mesh validator import, the "rejects …" cases below
// stop firing and turn red. (resources/** validators are outside the
// barrelCompleteness/ruleCoverage filesystem guards, so this is their
// registration safety net.)
import '../../../linter/index';

function errorsOf(diagnostics: ReturnType<Linter['lint']>) {
  return diagnostics.filter((d) => d.severity === 'error');
}

describe('QuadMesh strict validators', () => {
  let linter: Linter;

  beforeEach(() => {
    linter = new Linter();
  });

  it('passes the witnessed QuadMesh sub_resource (size + material)', () => {
    const content = `[gd_scene format=3]

[sub_resource type="StandardMaterial3D" id="m"]
albedo_color = Color(0.28, 0.28, 0.28, 1)

[sub_resource type="QuadMesh" id="q"]
material = SubResource("m")
size = Vector2(200, 200)
`;
    expect(errorsOf(linter.lint(content))).toEqual([]);
  });

  it('rejects a malformed size vector', () => {
    const content = `[gd_scene format=3]

[sub_resource type="QuadMesh" id="q"]
size = Vector2(200)
`;
    const errors = errorsOf(linter.lint(content));
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]!.message).toContain('size');
  });

  it('rejects a non-boolean flip_faces', () => {
    const content = `[gd_scene format=3]

[sub_resource type="QuadMesh" id="q"]
flip_faces = yes
`;
    const errors = errorsOf(linter.lint(content));
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]!.message).toContain('flip_faces');
  });
});
