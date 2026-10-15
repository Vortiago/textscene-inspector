import { describe, expect, it } from 'vitest';
import { ShaderMode, shaderModeOf } from './shaderLanguage';

describe('shaderModeOf', () => {
  it('runs a shader in the mode its shader_type names', () => {
    expect(shaderModeOf('shader_type fog;\nvoid fog() {}')).toBe(ShaderMode.FOG);
  });

  it('skips the comments and the whitespace before the declaration', () => {
    expect(shaderModeOf('// A sky.\n/* Blue. */\n\t shader_type  sky ;')).toBe(ShaderMode.SKY);
  });

  it('reads a declaration without its semicolon at the end of the code (edge case)', () => {
    expect(shaderModeOf('shader_type particles')).toBe(ShaderMode.PARTICLES);
  });

  it('runs a shader of an unknown shader_type as spatial (error case)', () => {
    expect(shaderModeOf('shader_type mist;')).toBe(ShaderMode.SPATIAL);
  });

  it('runs code that opens with another identifier as spatial (error case)', () => {
    expect(shaderModeOf('uniform float a;\nshader_type fog;')).toBe(ShaderMode.SPATIAL);
  });

  it('runs code that is only a comment as spatial (edge case)', () => {
    expect(shaderModeOf('// shader_type fog;')).toBe(ShaderMode.SPATIAL);
  });

  it('reads the declaration past the preprocessor directives before it (edge case)', () => {
    expect(
      shaderModeOf('// Wisps.\n#define DENSE\n  #include "res://fog.gdshaderinc"\nshader_type fog;')
    ).toBe(ShaderMode.FOG);
  });
});
