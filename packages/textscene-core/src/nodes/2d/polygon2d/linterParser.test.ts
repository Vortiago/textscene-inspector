/**
 * Tests for Polygon2D strict validators (format validation).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Linter } from '../../../linter/Linter';
import './linterParser';

function errorsOf(diagnostics: ReturnType<Linter['lint']>) {
  return diagnostics.filter((d) => d.severity === 'error');
}

describe('Polygon2D strict validators', () => {
  let linter: Linter;

  beforeEach(() => {
    linter = new Linter();
  });

  it('passes the witnessed textured/inverted Polygon2D form', () => {
    const content = `[gd_scene format=3]

[node name="Polygon2DInvertedTextured" type="Polygon2D"]
texture_repeat = 2
position = Vector2(349, -416)
color = Color(1, 0.490196, 0.356863, 1)
antialiased = true
invert_enabled = true
invert_border = 20.0
texture_offset = Vector2(1.139, -21.764)
polygon = PackedVector2Array(65.3057, 508.435, 117.632, 527.527, 155.815, 517.627, 155.108, 478.029)
`;
    expect(errorsOf(linter.lint(content))).toEqual([]);
  });

  it('rejects a malformed fill color', () => {
    const content = `[gd_scene format=3]

[node name="P" type="Polygon2D"]
color = Color(1, 0, 0)
`;
    const errors = errorsOf(linter.lint(content));
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]!.message).toContain('color');
  });

  it('rejects a non-boolean antialiased', () => {
    const content = `[gd_scene format=3]

[node name="P" type="Polygon2D"]
antialiased = sometimes
`;
    const errors = errorsOf(linter.lint(content));
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]!.message).toContain('antialiased');
  });

  it('rejects a malformed texture resource reference', () => {
    const content = `[gd_scene format=3]

[node name="P" type="Polygon2D"]
texture = "not-a-resource"
`;
    const errors = errorsOf(linter.lint(content));
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]!.message).toContain('texture');
  });
});
