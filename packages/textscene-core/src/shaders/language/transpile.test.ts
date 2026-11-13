/** The transpiler end to end: a shader text to the GLSL three generates for its TSL nodes. */

import { describe, expect, it } from 'vitest';
import { mat2, uniform, vec2, vec4 } from 'three/tsl';
import type { Node } from 'three/webgpu';
import { generatedFragmentShader } from '../generatedShader.testkit.js';
import { ShadingLanguageError } from './shadingLanguageError.js';
import { transpileShadingLanguage } from './transpile.js';

/** `vec4` of a node of any float type, which three's overloads do not list for an untyped node. */
const colourOf = vec4 as unknown as (node: Node) => Node;

/** The GLSL of function `probe` of `source` over `args`, written as a colour. */
function glslOf(source: string, args: Node[] = []): string {
  const probe = transpileShadingLanguage(source).functions.get('probe')!;
  return generatedFragmentShader(colourOf(probe.call(args)));
}

describe('transpileShadingLanguage', () => {
  it('names each function with its head', () => {
    const probe = transpileShadingLanguage('vec2 probe(vec2 a, float b) { return a; }').functions.get(
      'probe'
    );
    expect([probe?.returnType, probe?.arguments.map((argument) => argument.type)]).toEqual([
      'vec2',
      ['vec2', 'float'],
    ]);
  });

  it('emits each operator as its GLSL operation', () => {
    const glsl = glslOf('float probe(float a, float b) { return -(a + b) * a / b - a; }', [
      uniform(1),
      uniform(2),
    ]);
    expect(glsl).toMatch(/\( - \( \w+ \+ \w+ \) \)/);
    expect(glsl).toMatch(/\* \w+ \) \/ \w+ \) - \w+/);
  });

  it('folds the arithmetic of constants in double precision from the text Godot writes, as glslang does', () => {
    expect(glslOf('float probe() { return 58.656 + 74.377; }')).toContain('133.0330047607422');
  });

  it('writes a negative zero constant as its bits, which three would write as 0.0', () => {
    expect(glslOf('float probe() { return -0.0; }')).toContain('uintBitsToFloat( 2147483648u )');
  });

  it('writes a negation of a negation as Godot writes it: the inner one alone', () => {
    expect(glslOf('float probe(float a) { return -(-a); }', [uniform(2)])).toMatch(
      /= \( - \w+ \)|\( - nodeUniform/
    );
  });

  it('emits a swizzle as its lanes in xyzw letters', () => {
    expect(glslOf('vec3 probe(vec4 a) { return a.bgr; }', [uniform(vec4(1, 2, 3, 4))])).toMatch(/\.zyx/);
  });

  it('emits a constructor of mixed arguments', () => {
    expect(
      glslOf('vec3 probe(vec2 a, float b) { return vec3(b, a); }', [uniform(vec2(1, 2)), uniform(3)])
    ).toMatch(/vec3\( \w+, \w+ \)/);
  });

  it.each(['+', '-', '*', '/'])(
    'writes a scalar %s matrix column by column, which three writes unbracketed',
    (op) => {
      const glsl = glslOf(`mat2 probe(mat2 a, float b) { return b * (b ${op} a); }`, [
        uniform(mat2(1, 2, 3, 4)),
        uniform(2),
      ]);
      expect(glsl).toContain(
        `mat2( ( vec2( nodeUniform0 ) ${op} nodeUniform1[ 0 ] ), ( vec2( nodeUniform0 ) ${op} nodeUniform1[ 1 ] ) )`
      );
    }
  );

  it('refuses a text Godot refuses', () => {
    expect(() => transpileShadingLanguage('vec3 probe(vec3 a) { return a.q; }')).toThrow(
      ShadingLanguageError
    );
  });

  it.each([
    ['a read', 'float probe(vec2 a) { return a[1 + 5]; }', 6],
    ['a write', 'vec2 probe(vec2 a, float b) { a[1 + 5] = b; return a; }', 6],
    ['a uint that wraps', 'vec3 probe(mat3 m) { return m[0u - 1u]; }', -1],
  ])('refuses %s at an index glslang folds out of range, as the GPU compiler does', (_, source, index) => {
    expect(() => transpileShadingLanguage(source)).toThrow(`glslang folds the index to ${index}`);
  });

  it('refuses the wrong count of arguments to a transpiled function', () => {
    const probe = transpileShadingLanguage('float probe(float a) { return a; }').functions.get('probe')!;
    expect(() => probe.call([])).toThrow('expected 1 arguments for probe, got 0');
  });
});
