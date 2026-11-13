import { describe, expect, it } from 'vitest';
import { parseRejection } from '../../../../scripts/godot-probes/rejection.mjs';

const GLSL_FAILURE = `ERROR: Error compiling Fragment shader.
   at: compile_stages (servers/rendering/renderer_rd/shader_rd.cpp:1000)
ERROR: Failed parse:
ERROR: 0:322: 'inf' : undeclared identifier 
ERROR: 0:322: '' : compilation terminated 
ERROR: 2 compilation errors.  No code generated.
`;

const LANGUAGE_FAILURE = `SHADER ERROR: Invalid arguments to operator '+': 'vec2, vec3'.
          at: (null) (:9)
`;

describe("Godot's reason for a probe it draws nothing for", () => {
  it("reads the GPU compiler's first message on Godot's GLSL, with no line", () => {
    expect(parseRejection(GLSL_FAILURE)).toEqual({ stage: 'GLSL', message: "'inf' : undeclared identifier" });
  });

  it("reads Godot's own message and line of the probe's shader", () => {
    expect(parseRejection(LANGUAGE_FAILURE)).toEqual({
      stage: 'shading language',
      message: "Invalid arguments to operator '+': 'vec2, vec3'.",
      line: 9,
    });
  });

  it('throws on output that names no error', () => {
    expect(() => parseRejection('GODOT 4.6.3-stable\n')).toThrow(/expected Godot's shader error/);
  });
});
