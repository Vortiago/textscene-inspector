/**
 * Tests for CSGCombiner3D strict validators (format validation).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Linter } from '../../../../linter/Linter';
import './linterParser';

function errorsOf(diagnostics: ReturnType<Linter['lint']>) {
  return diagnostics.filter((d) => d.severity === 'error');
}

function scene(body: string): string {
  return `[gd_scene format=3]\n\n[node name="C" type="CSGCombiner3D"]\n${body}\n`;
}

describe('CSGCombiner3D strict validators', () => {
  let linter: Linter;

  beforeEach(() => {
    linter = new Linter();
  });

  it('passes the vendored witness shape (ragdoll_physics.tscn:92)', () => {
    expect(errorsOf(linter.lint(scene('visible = false')))).toEqual([]);
  });

  it('passes a combiner carrying an operation', () => {
    expect(errorsOf(linter.lint(scene('operation = 2')))).toEqual([]);
  });

  it('rejects an out-of-range operation', () => {
    const errors = errorsOf(linter.lint(scene('operation = 5')));
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]!.message).toContain('operation');
  });

  it('rejects a malformed transform via the inherited Node3D validator', () => {
    const errors = errorsOf(linter.lint(scene('transform = Transform3D(nope)')));
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]!.message).toContain('transform');
  });
});
