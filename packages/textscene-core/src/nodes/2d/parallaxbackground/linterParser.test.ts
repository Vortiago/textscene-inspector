/**
 * Tests the ParallaxBackground strict validators.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Linter } from '../../../linter/Linter';
import './linterParser';

function errorsOf(diagnostics: ReturnType<Linter['lint']>) {
  return diagnostics.filter((d) => d.severity === 'error');
}

describe('ParallaxBackground strict validators', () => {
  let linter: Linter;

  beforeEach(() => {
    linter = new Linter();
  });

  it('passes the full CanvasLayer + scroll surface', () => {
    const content = `[gd_scene format=3]

[node name="X" type="ParallaxBackground"]
layer = -100
transform = Transform2D(0.5, 0, 0, 0.5, 0, -427)
follow_viewport_enabled = true
scroll_base_offset = Vector2(0, 0)
scroll_base_scale = Vector2(0.1, 0)
scroll_limit_begin = Vector2(-100, -100)
scroll_limit_end = Vector2(900, 500)
scroll_ignore_camera_zoom = false
`;

    expect(errorsOf(linter.lint(content))).toEqual([]);
  });

  it('rejects a Transform3D where a CanvasLayer takes a Transform2D', () => {
    const content = `[gd_scene format=3]

[node name="X" type="ParallaxBackground"]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0)
`;

    const errors = errorsOf(linter.lint(content));
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]!.message).toContain('Transform2D');
  });

  it('rejects a malformed scroll vector', () => {
    const content = `[gd_scene format=3]

[node name="X" type="ParallaxBackground"]
scroll_base_scale = Vector2(nope)
`;

    const errors = errorsOf(linter.lint(content));
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]!.message).toContain('scroll_base_scale');
  });
});
