/**
 * Line2D strict validators: a witnessed Line2D form lints clean, and a malformed
 * `default_color` or a non-numeric `width` is rejected.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Linter } from '../../../linter/Linter';
import './linterParser';

/** Phase-1 errors only: the references below are format cases, and a declared id is not the question. */
function errorsOf(diagnostics: ReturnType<Linter['lint']>) {
  return diagnostics.filter((d) => d.severity === 'error' && d.ruleName === 'strict-parser');
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

  it('passes a witnessed textured, gradient-skinned Line2D form (scenes/demos/2d/polygons_lines)', () => {
    const content = `[gd_scene format=3]

[node name="Line2DVariableWidthColor" type="Line2D"]
points = PackedVector2Array(69.9547, 69.8821, 75.0088, 79.6931, 145.805, 83.9676)
width_curve = SubResource("1")
gradient = SubResource("2")
texture = ExtResource("1")
texture_mode = 2
antialiased = true
begin_cap_mode = 1
end_cap_mode = 2
`;
    expect(errorsOf(linter.lint(content))).toEqual([]);
  });

  it('accepts PackedVector2Array(…), the only spelling get_points (line_2d.cpp:122-124) ever produces (get_points returns Vector<Vector2> directly, not a TypedArray)', () => {
    const content = `[gd_scene format=3]\n\n[node name="L" type="Line2D"]\npoints = PackedVector2Array(0, 0, 1, 0, 1, 1)\n`;
    expect(errorsOf(linter.lint(content))).toEqual([]);
  });

  it('rejects a malformed points literal', () => {
    const content = `[gd_scene format=3]\n\n[node name="L" type="Line2D"]\npoints = "not-a-vector-array"\n`;
    const errors = errorsOf(linter.lint(content));
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]!.message).toContain('points');
  });

  it('rejects a non-boolean antialiased', () => {
    const content = `[gd_scene format=3]\n\n[node name="L" type="Line2D"]\nantialiased = sometimes\n`;
    const errors = errorsOf(linter.lint(content));
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]!.message).toContain('antialiased');
  });

  it('rejects a malformed gradient resource reference', () => {
    const content = `[gd_scene format=3]\n\n[node name="L" type="Line2D"]\ngradient = "not-a-resource"\n`;
    const errors = errorsOf(linter.lint(content));
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]!.message).toContain('gradient');
  });

  it('rejects a malformed texture resource reference', () => {
    const content = `[gd_scene format=3]\n\n[node name="L" type="Line2D"]\ntexture = "not-a-resource"\n`;
    const errors = errorsOf(linter.lint(content));
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]!.message).toContain('texture');
  });

  it('rejects a malformed width_curve resource reference', () => {
    const content = `[gd_scene format=3]\n\n[node name="L" type="Line2D"]\nwidth_curve = "not-a-resource"\n`;
    const errors = errorsOf(linter.lint(content));
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]!.message).toContain('width_curve');
  });

  describe.each(['gradient', 'texture', 'width_curve'] as const)('%s resource reference spellings', (prop) => {
    it(`accepts SubResource(id) (resourceRef, godot/resourceRef.ts)`, () => {
      const content = `[gd_scene format=3]\n\n[node name="L" type="Line2D"]\n${prop} = SubResource("7")\n`;
      expect(errorsOf(linter.lint(content))).toEqual([]);
    });

    it(`accepts ExtResource(id), the other spelling Godot's own writer produces`, () => {
      const content = `[gd_scene format=3]\n\n[node name="L" type="Line2D"]\n${prop} = ExtResource("7")\n`;
      expect(errorsOf(linter.lint(content))).toEqual([]);
    });

    it('accepts internal whitespace padding around the id', () => {
      const content = `[gd_scene format=3]\n\n[node name="L" type="Line2D"]\n${prop} = SubResource( "7" )\n`;
      expect(errorsOf(linter.lint(content))).toEqual([]);
    });
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

    it('warns on an out-of-range texture_mode (line_2d.cpp:402, no ERR_FAIL_INDEX)', () => {
      const content = `[gd_scene format=3]\n\n[node name="L" type="Line2D"]\ntexture_mode = 9\n`;
      const found = linter.lint(content).find((d) => d.message.includes('texture_mode'));
      expect(found?.severity).toBe('warning');
    });

    it('warns on an out-of-range begin_cap_mode (line_2d.cpp:405, no ERR_FAIL_INDEX)', () => {
      const content = `[gd_scene format=3]\n\n[node name="L" type="Line2D"]\nbegin_cap_mode = 9\n`;
      const found = linter.lint(content).find((d) => d.message.includes('begin_cap_mode'));
      expect(found?.severity).toBe('warning');
    });

    it('warns on an out-of-range end_cap_mode (line_2d.cpp:406, no ERR_FAIL_INDEX)', () => {
      const content = `[gd_scene format=3]\n\n[node name="L" type="Line2D"]\nend_cap_mode = 9\n`;
      const found = linter.lint(content).find((d) => d.message.includes('end_cap_mode'));
      expect(found?.severity).toBe('warning');
    });

    describe.each([
      ['texture_mode', 'line_2d.cpp:402'],
      ['begin_cap_mode', 'line_2d.cpp:405'],
      ['end_cap_mode', 'line_2d.cpp:406'],
    ] as const)('%s enum bound (%s)', (prop, cite) => {
      it(`accepts 2, the top BIND_ENUM_CONSTANT the ${cite} hint's 3-label list names`, () => {
        const content = `[gd_scene format=3]\n\n[node name="L" type="Line2D"]\n${prop} = 2\n`;
        expect(errorsOf(linter.lint(content))).toEqual([]);
      });

      it('warns (not errors) at 3, the first value past the hint — the setter assigns unconditionally', () => {
        const content = `[gd_scene format=3]\n\n[node name="L" type="Line2D"]\n${prop} = 3\n`;
        const found = linter.lint(content).find((d) => d.message.includes(prop));
        expect(found?.severity).toBe('warning');
      });
    });
  });
});
