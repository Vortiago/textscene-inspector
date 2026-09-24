/**
 * What a QuadMesh sub_resource validates, all of it inherited: `size` and
 * `center_offset` are PlaneMesh's, `flip_faces` and `material` PrimitiveMesh's.
 * The cases ride the resource base-walk and prove it reaches a leaf two hops down.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Linter } from '../../../linter/Linter';
// The full linter barrel, so a mesh validator import dropped from
// linter/index.ts turns the "rejects …" cases red. resources/** validators are
// outside the barrelCompleteness/ruleCoverage guards, so this guards their wiring.
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
