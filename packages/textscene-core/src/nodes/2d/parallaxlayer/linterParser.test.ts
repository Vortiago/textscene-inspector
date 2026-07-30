/**
 * Tests for ParallaxLayer strict validators (format validation).
 *
 * Only the slice's OWN keys: `transform` / `position` and the rest of the Node2D
 * surface reach a ParallaxLayer through the base walk, so re-declaring (or
 * re-testing) them here would be the shadow copy the registry meta-guard bans.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Linter } from '../../../linter/Linter';
import './linterParser';

function errorsOf(diagnostics: ReturnType<Linter['lint']>) {
  return diagnostics.filter((d) => d.severity === 'error');
}

describe('ParallaxLayer strict validators', () => {
  let linter: Linter;

  beforeEach(() => {
    linter = new Linter();
  });

  it('passes a valid motion surface', () => {
    const content = `[gd_scene format=3]

[node name="X" type="ParallaxLayer"]
motion_scale = Vector2(0.2, 1)
motion_offset = Vector2(-550, 0)
motion_mirroring = Vector2(400, 0)
`;

    expect(errorsOf(linter.lint(content))).toEqual([]);
  });

  it('rejects a malformed motion_scale', () => {
    const content = `[gd_scene format=3]

[node name="X" type="ParallaxLayer"]
motion_scale = Vector2(nope)
`;

    const errors = errorsOf(linter.lint(content));
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]!.message).toContain('motion_scale');
  });

  it('rejects a motion_mirroring that is not a Vector2', () => {
    const content = `[gd_scene format=3]

[node name="X" type="ParallaxLayer"]
motion_mirroring = 400
`;

    const errors = errorsOf(linter.lint(content));
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]!.message).toContain('motion_mirroring');
  });
});
