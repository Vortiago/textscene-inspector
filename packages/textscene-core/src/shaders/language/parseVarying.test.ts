import { describe, expect, it } from 'vitest';
import type { RenderingMethod } from '../preprocessor/preprocessor.js';
import { parsedShader } from './parseShader.js';

const TOO_MANY = /Too many varyings used in shader \(33 used, maximum supported is 32\)/;

/** The parse of `varyings` in a shader of `shaderType`, which throws Godot's refusal. */
const parseOf =
  (varyings: string, shaderType = 'spatial', renderingMethod: RenderingMethod = 'forward_plus') =>
  () =>
    parsedShader(`shader_type ${shaderType};\n${varyings}\nvoid fragment() {}\n`, { renderingMethod });

describe('the varying limit of the parser', () => {
  it('accepts the 17 vec4 slots a spatial shader has after the 15 of the template', () => {
    expect(parseOf('varying vec4 v[17];')).not.toThrow();
  });

  it('refuses an 18th vec4 slot in a spatial shader (error case)', () => {
    expect(parseOf('varying vec4 v[18];')).toThrow(TOO_MANY);
  });

  it('counts each column of a matrix as a slot (edge case)', () => {
    expect([parseOf('varying mat4 m[4];'), parseOf('varying mat3 m[6];')].map(isRefused)).toEqual([
      false,
      true,
    ]);
  });

  it('adds the slots of each varying in turn', () => {
    expect(parseOf('varying vec4 a[10];\nvarying vec2 b[8];')).toThrow(TOO_MANY);
  });

  it('starts canvas_item after the 9 slots of its template', () => {
    expect(
      ['vec4 v[23]', 'vec4 v[24]'].map((v) => isRefused(parseOf(`varying ${v};`, 'canvas_item')))
    ).toEqual([false, true]);
  });

  it('starts at slot 0 in the gl_compatibility renderer, whose template takes none', () => {
    expect(parseOf('varying vec4 v[32];', 'spatial', 'gl_compatibility')).not.toThrow();
  });

  it('refuses a smooth integer varying (error case)', () => {
    expect(parseOf('varying int v;\nvoid vertex() {\n\tv = 1;\n}')).toThrow(
      'Varying with integer data type must be declared with `flat` interpolation qualifier.'
    );
  });
});

function isRefused(parse: () => unknown): boolean {
  try {
    parse();
    return false;
  } catch {
    // A thrown parse is the refusal this answers.
    return true;
  }
}
