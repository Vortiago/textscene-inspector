/**
 * Tests for Timer strict validators (format validation).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Linter } from '../../../linter/Linter';
import './linterParser';

function errorsOf(diagnostics: ReturnType<Linter['lint']>) {
  return diagnostics.filter((d) => d.severity === 'error');
}

describe('Timer strict validators', () => {
  let linter: Linter;

  beforeEach(() => {
    linter = new Linter();
  });

  it('passes a valid Timer with a transform', () => {
    const content = `[gd_scene format=3]

[node name="X" type="Timer"]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0)
`;

    expect(errorsOf(linter.lint(content))).toEqual([]);
  });

  it('rejects a malformed transform', () => {
    const content = `[gd_scene format=3]

[node name="X" type="Timer"]
transform = Transform3D(nope)
`;

    const errors = errorsOf(linter.lint(content));
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]!.message).toContain('transform');
  });

  it('passes a valid Timer with wait_time/autostart/one_shot/process_callback', () => {
    const content = `[gd_scene format=3]

[node name="X" type="Timer"]
wait_time = 1.5
autostart = true
one_shot = true
paused = false
process_callback = 0
ignore_time_scale = false
`;

    expect(errorsOf(linter.lint(content))).toEqual([]);
  });

  it('rejects a non-positive wait_time', () => {
    const content = `[gd_scene format=3]

[node name="X" type="Timer"]
wait_time = 0
`;

    const errors = errorsOf(linter.lint(content));
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]!.message).toContain('wait_time');
  });

  it('rejects an out-of-range process_callback', () => {
    const content = `[gd_scene format=3]

[node name="X" type="Timer"]
process_callback = 5
`;

    const errors = errorsOf(linter.lint(content));
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]!.message).toContain('process_callback');
  });
});
