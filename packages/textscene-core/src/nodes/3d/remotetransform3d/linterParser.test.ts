/**
 * Tests for RemoteTransform3D strict validators (format validation).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Linter } from '../../../linter/Linter';
import './linterParser';

function errorsOf(diagnostics: ReturnType<Linter['lint']>) {
  return diagnostics.filter((d) => d.severity === 'error');
}

describe('RemoteTransform3D strict validators', () => {
  let linter: Linter;

  beforeEach(() => {
    linter = new Linter();
  });

  it('passes a valid RemoteTransform3D with a transform', () => {
    const content = `[gd_scene format=3]

[node name="X" type="RemoteTransform3D"]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0)
`;

    expect(errorsOf(linter.lint(content))).toEqual([]);
  });

  it('rejects a malformed transform', () => {
    const content = `[gd_scene format=3]

[node name="X" type="RemoteTransform3D"]
transform = Transform3D(nope)
`;

    const errors = errorsOf(linter.lint(content));
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]!.message).toContain('transform');
  });

  it('passes a valid RemoteTransform3D with remote_path and update flags', () => {
    const content = `[gd_scene format=3]

[node name="X" type="RemoteTransform3D"]
remote_path = NodePath("../DetachTransform/Geometry")
update_position = true
update_rotation = false
update_scale = false
use_global_coordinates = true
`;

    expect(errorsOf(linter.lint(content))).toEqual([]);
  });

  it('rejects a malformed remote_path', () => {
    const content = `[gd_scene format=3]

[node name="X" type="RemoteTransform3D"]
remote_path = "../DetachTransform/Geometry"
`;

    const errors = errorsOf(linter.lint(content));
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]!.message).toContain('remote_path');
  });
});
