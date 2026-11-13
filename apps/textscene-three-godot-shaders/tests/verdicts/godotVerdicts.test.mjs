import { describe, expect, it } from 'vitest';
import { parseVerdictOutput } from '../../../../scripts/godot-probes/shaderVerdicts.mjs';

/** Godot's output for two shaders, the first refused, as Godot 4.6.3 prints it under xvfb. */
const OUTPUT = `VERDICT 0
--Main Shader--
    1 | shader_type canvas_item;
E   2-> void f(int a, float b) { a + b; }
    3 |
SHADER ERROR: Invalid arguments to operator '+': 'int, float'.
          at: (null) (:2)
          GDScript backtrace (most recent call first):
              [0] _ready (res://main.gd:8)
ERROR: Shader compilation failed.
   at: set_code (servers/rendering/renderer_rd/renderer_canvas_render_rd.cpp:1587)
VERDICT 1
VERDICTS DONE
`;

describe("Godot's verdict on a shader text", () => {
  it("reads Godot's message and line for a shader it refuses", () => {
    expect(parseVerdictOutput(OUTPUT, 2)[0]).toEqual({
      accepted: false,
      message: "Invalid arguments to operator '+': 'int, float'.",
      line: 2,
    });
  });

  it('reads a shader with no error as accepted', () => {
    expect(parseVerdictOutput(OUTPUT, 2)[1]).toEqual({ accepted: true });
  });

  it('throws on a shader error whose line it cannot read, not reading it as accepted', () => {
    const output = 'VERDICT 0\nSHADER ERROR: Unknown error.\n   at: compile (shader.cpp:10)\nVERDICTS DONE\n';
    expect(() => parseVerdictOutput(output, 1)).toThrow(/at: \(null\)/);
  });

  it('throws when the run stopped before the last shader', () => {
    expect(() => parseVerdictOutput('VERDICT 0\n', 1)).toThrow(/VERDICTS DONE/);
  });
});
