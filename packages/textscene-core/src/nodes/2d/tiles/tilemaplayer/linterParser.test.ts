/**
 * Tests for TileMapLayer strict validators (format validation).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Linter } from '../../../../linter/Linter';
import './linterParser';

function errorsOf(diagnostics: ReturnType<Linter['lint']>) {
  return diagnostics.filter((d) => d.severity === 'error');
}

describe('TileMapLayer strict validators', () => {
  let linter: Linter;

  beforeEach(() => {
    linter = new Linter();
  });

  it('passes a valid TileMapLayer with a transform', () => {
    const content = `[gd_scene format=3]

[node name="X" type="TileMapLayer"]
transform = Transform2D(1, 0, 0, 1, 0, 0)
`;

    expect(errorsOf(linter.lint(content))).toEqual([]);
  });

  it('rejects a malformed transform', () => {
    const content = `[gd_scene format=3]

[node name="X" type="TileMapLayer"]
transform = Transform2D(nope)
`;

    const errors = errorsOf(linter.lint(content));
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]!.message).toContain('transform');
  });
});
