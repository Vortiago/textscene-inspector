/**
 * Tests for RemoteTransform2D strict validators (format validation).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Linter } from '../../../linter/Linter';
import './linterParser';

function errorsOf(diagnostics: ReturnType<Linter['lint']>) {
  return diagnostics.filter((d) => d.severity === 'error');
}

describe('RemoteTransform2D strict validators', () => {
  let linter: Linter;

  beforeEach(() => {
    linter = new Linter();
  });

  it('passes a valid RemoteTransform2D with a transform', () => {
    const content = `[gd_scene format=3]

[node name="X" type="RemoteTransform2D"]
transform = Transform2D(1, 0, 0, 1, 0, 0)
`;

    expect(errorsOf(linter.lint(content))).toEqual([]);
  });

  it('rejects a malformed transform', () => {
    const content = `[gd_scene format=3]

[node name="X" type="RemoteTransform2D"]
transform = Transform2D(nope)
`;

    const errors = errorsOf(linter.lint(content));
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]!.message).toContain('transform');
  });

  it('passes a valid RemoteTransform2D with remote_path and update flags', () => {
    const content = `[gd_scene format=3]

[node name="X" type="RemoteTransform2D"]
remote_path = NodePath("../../Camera2D")
update_position = true
update_rotation = false
update_scale = true
use_global_coordinates = false
`;

    expect(errorsOf(linter.lint(content))).toEqual([]);
  });

  it('rejects a malformed remote_path', () => {
    const content = `[gd_scene format=3]

[node name="X" type="RemoteTransform2D"]
remote_path = "../../Camera2D"
`;

    const errors = errorsOf(linter.lint(content));
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]!.message).toContain('remote_path');
  });
});
