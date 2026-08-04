/**
 * Tests for CSGCombiner3D strict validators (format validation).
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

  it('warns (not errors) on an out-of-range operation', () => {
    // csg_shape.cpp:1040 hints the enum but set_operation:933-937 is a bare
    // assignment, so out-of-range is a warning, not an error (ADR-0032).
    expect(errorsOf(linter.lint(scene('operation = 5')))).toEqual([]);
    const warnings = warningsOf(linter.lint(scene('operation = 5')));
    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings[0]!.message).toContain('operation');
  });

  it('rejects a malformed transform via the inherited Node3D validator', () => {
    const errors = errorsOf(linter.lint(scene('transform = Transform3D(nope)')));
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]!.message).toContain('transform');
  });
});
