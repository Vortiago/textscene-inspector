import { describe, expect, it } from 'vitest';
import { shaderTypeOf } from './shaderLanguage';

describe('shaderTypeOf', () => {
  it('reads the shader_type a shader declares first', () => {
    expect(shaderTypeOf('shader_type fog;\nvoid fog() {}')).toBe('fog');
  });

  it('skips the comments and the whitespace before the declaration', () => {
    expect(shaderTypeOf('// A fog.\n/* Red. */\n\t shader_type  spatial ;')).toBe('spatial');
  });

  it('reads a declaration without its semicolon at the end of the code (edge case)', () => {
    expect(shaderTypeOf('shader_type sky')).toBe('sky');
  });

  it('reads no type from code that opens with another identifier (error case)', () => {
    expect(shaderTypeOf('uniform float a;\nshader_type fog;')).toBe('');
  });

  it('reads no type from code that is only a comment (error case)', () => {
    expect(shaderTypeOf('// shader_type fog;')).toBe('');
  });
});
