/**
 * Tests for CSGBox3D strict validators (format validation).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Linter } from '../../../../linter/Linter';
import './linterParser';

function errorsOf(diagnostics: ReturnType<Linter['lint']>) {
  return diagnostics.filter((d) => d.severity === 'error');
}

describe('CSGBox3D strict validators', () => {
  let linter: Linter;

  beforeEach(() => {
    linter = new Linter();
  });

  it('passes a valid CSGBox3D with size, operation, and transform', () => {
    const content = `[gd_scene format=3]

[node name="Box" type="CSGBox3D"]
size = Vector3(2, 1, 3)
operation = 1
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0)
`;

    expect(errorsOf(linter.lint(content))).toEqual([]);
  });

  it('rejects a malformed size vector', () => {
    const content = `[gd_scene format=3]

[node name="Box" type="CSGBox3D"]
size = Vector3(2, 1)
`;

    const errors = errorsOf(linter.lint(content));
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]!.message).toContain('size');
  });

  it('rejects an out-of-range operation enum', () => {
    const content = `[gd_scene format=3]

[node name="Box" type="CSGBox3D"]
operation = 5
`;

    const errors = errorsOf(linter.lint(content));
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]!.message).toContain('operation');
  });

  it('rejects a malformed material resource reference', () => {
    const content = `[gd_scene format=3]

[node name="Box" type="CSGBox3D"]
material = "not-a-resource"
`;

    const errors = errorsOf(linter.lint(content));
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]!.message).toContain('material');
  });
});
