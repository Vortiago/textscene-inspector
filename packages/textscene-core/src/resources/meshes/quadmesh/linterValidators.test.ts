/**
 * Tests for QuadMesh strict validators (format validation).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Linter } from '../../../linter/Linter';
// Import the FULL linter barrel (not './linterValidators' directly) so these
// cases also guard the barrel wiring: if linter/index.ts drops the QuadMesh
// validator import, the "rejects …" cases below stop firing and turn red.
// (resources/** validators are outside the barrelCompleteness/ruleCoverage
// filesystem guards, so this is their registration safety net.)
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
