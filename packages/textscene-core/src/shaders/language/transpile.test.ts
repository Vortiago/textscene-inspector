/** The transpiler end to end: a shader text to the GLSL three generates for its TSL nodes. */

import { describe, expect, it } from 'vitest';
import { uniform, vec2, vec4 } from 'three/tsl';
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
    expect([probe?.returnType, probe?.parameters.map((parameter) => parameter.type)]).toEqual([
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

  it('writes a literal as the float Godot draws it with', () => {
    expect(glslOf('float probe() { return 1e-20 + 0.1; }')).toContain('0.0 + 0.10000000149011612');
  });

  it('negates a zero literal, which keeps the sign of -0.0', () => {
    expect(glslOf('float probe() { return -0.0; }')).toContain('- 0.0');
  });

  it('emits a swizzle as its lanes in xyzw letters', () => {
    expect(glslOf('vec3 probe(vec4 a) { return a.bgr; }', [uniform(vec4(1, 2, 3, 4))])).toMatch(/\.zyx/);
  });

  it('emits a constructor of mixed arguments', () => {
    expect(
      glslOf('vec3 probe(vec2 a, float b) { return vec3(b, a); }', [uniform(vec2(1, 2)), uniform(3)])
    ).toMatch(/vec3\( \w+, \w+ \)/);
  });

  it('refuses a text Godot refuses', () => {
    expect(() => transpileShadingLanguage('vec3 probe(vec3 a) { return a.q; }')).toThrow(
      ShadingLanguageError
    );
  });

  it('refuses the wrong count of arguments to a transpiled function', () => {
    const probe = transpileShadingLanguage('float probe(float a) { return a; }').functions.get('probe')!;
    expect(() => probe.call([])).toThrow('expected 1 arguments for probe, got 0');
  });
});
