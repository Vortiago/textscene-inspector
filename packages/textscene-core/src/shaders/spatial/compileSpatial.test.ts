import { describe, expect, it } from 'vitest';
import { compileSpatial } from './compileSpatial.js';

describe('compileSpatial', () => {
  it('compiles an unshaded shader', () => {
    const compile = compileSpatial('shader_type spatial;\nrender_mode unshaded;\n', {});
    expect('spatial' in compile).toBe(true);
  });

  it('compiles an unshaded shader that writes an output only the light reads', () => {
    const code = 'shader_type spatial;\nrender_mode unshaded;\nvoid fragment() { EMISSION = vec3(1.0); }\n';
    expect('spatial' in compileSpatial(code, {})).toBe(true);
  });

  it('refuses a lit shader with the owner of the light loop, as its draw needs it', () => {
    const compile = compileSpatial('shader_type spatial;\nvoid fragment() { ALBEDO = vec3(1.0); }\n', {});
    expect(compile).toMatchObject({ refusal: { owner: '#1453', message: expect.stringContaining('lit') } });
  });

  it("gives Godot's refusal of a lit text before its own", () => {
    const compile = compileSpatial('shader_type spatial;\nvoid fragment() { ALBEDO = missing; }\n', {});
    expect(compile).toMatchObject({ refusal: { owner: undefined } });
  });
});
