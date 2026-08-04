/**
 * RED contract for Line2D strict validators. The validators must
 * be lenient enough that a witnessed Line2D form lints clean (so the bulk
 * fixtureLint guard stays green), while still rejecting a malformed
 * `default_color` or a non-numeric `width`. Mirrors the Polygon2D linter test.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Linter } from '../../../linter/Linter';
import './linterParser';

function errorsOf(diagnostics: ReturnType<Linter['lint']>) {
  return diagnostics.filter((d) => d.severity === 'error');
}

describe('Line2D strict validators', () => {
  let linter: Linter;

  beforeEach(() => {
    linter = new Linter();
  });

  it('passes a witnessed Line2D form', () => {
    const content = `[gd_scene format=3]

[node name="Line2DSharpNone" type="Line2D"]
position = Vector2(8, 40)
points = PackedVector2Array(411.081, 529.648, 500.884, 379.034, 568.766, 526.113)
width = 30.0
default_color = Color(1, 1, 1, 0.752941)
`;
    expect(errorsOf(linter.lint(content))).toEqual([]);
  });

  it('rejects a malformed default_color', () => {
    const content = `[gd_scene format=3]

[node name="L" type="Line2D"]
default_color = Color(1, 0, 0)
`;
    const errors = errorsOf(linter.lint(content));
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]!.message).toContain('default_color');
  });

  it('rejects a non-numeric width', () => {
    const content = `[gd_scene format=3]

[node name="L" type="Line2D"]
width = wide
`;
    const errors = errorsOf(linter.lint(content));
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]!.message).toContain('width');
  });

  describe('ADR-0032 tiering', () => {
    it('errors below the enforced round_precision floor (line_2d.cpp:255-256)', () => {
      const content = `[gd_scene format=3]\n\n[node name="L" type="Line2D"]\nround_precision = 0\n`;
      const found = linter.lint(content).find((d) => d.message.includes('round_precision'));
      expect(found?.severity).toBe('error');
    });

    it('warns above the hinted round_precision ceiling (line_2d.cpp:409)', () => {
      const content = `[gd_scene format=3]\n\n[node name="L" type="Line2D"]\nround_precision = 64\n`;
      const found = linter.lint(content).find((d) => d.message.includes('round_precision'));
      expect(found?.severity).toBe('warning');
    });

    it('warns on an out-of-range joint_mode (line_2d.cpp:404, no ERR_FAIL_INDEX)', () => {
      const content = `[gd_scene format=3]\n\n[node name="L" type="Line2D"]\njoint_mode = 9\n`;
      const found = linter.lint(content).find((d) => d.message.includes('joint_mode'));
      expect(found?.severity).toBe('warning');
    });
  });
});
