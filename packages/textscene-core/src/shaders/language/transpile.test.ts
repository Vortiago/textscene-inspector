/** The transpiler end to end: a shader text to the GLSL three generates for its TSL nodes. */

import { describe, expect, it } from 'vitest';
import { mat2, uniform, vec2, vec4 } from 'three/tsl';
import { Vector2 } from 'three';
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
      /vec4\( \( - nodeUniform0 \) \)/
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

  it('refuses a row that is not transpiled before it reaches the emitter', () => {
    expect(() => transpileShadingLanguage('float probe(float a) { return sin(a); }')).toThrow(
      "'sin(float)' is not transpiled yet (#1826)"
    );
  });

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

  describe('a call', () => {
    it('calls one GLSL function from each place, as Godot GLSL does', () => {
      const glsl = glslOf(
        'float twice(float x) { return x * 2.0; } float probe(float a) { return twice(a) + twice(1.5); }',
        [uniform(1)]
      );
      expect(glsl).toContain('float sl0_twice ( float p0 )');
      expect(glsl.match(/sl0_twice\( /g)).toHaveLength(2);
    });

    it('gives each overload a GLSL function of its own', () => {
      const glsl = glslOf(
        'float f(float x) { return x; } vec2 f(vec2 x) { return x; } float probe(float a) { return f(a) + f(vec2(a)).y; }',
        [uniform(1)]
      );
      expect(glsl).toMatch(/float sl0_f \( float p0 \)[\s\S]*vec2 sl1_f \( vec2 p0 \)/);
    });

    it('gives back the out values in one struct and writes them to their places', () => {
      const glsl = glslOf(
        'void halves(float v, out float h, out float q) { h = v * 0.5; q = v * 0.25; } float probe(float a) { float h; float q; halves(a, h, q); return h - q; }',
        [uniform(1)]
      );
      expect(glsl).toMatch(/struct sl0_halves_results \{\s*float m0;\s*float m1;\s*\}/);
      expect(glsl).toMatch(
        /(nodeVar\d+) = sl0_halves\( [^)]+\);\s*nodeVar\d+ = \1\.m0;\s*nodeVar\d+ = \1\.m1;/
      );
    });

    it('passes an inout value and an array, and gives back an array in a struct', () => {
      const glsl = glslOf(
        'int[2] swap(inout int n, int v[2]) { n++; return int[2](v[1], v[0]); } int probe(int a) { int v[2] = int[2](a, 1); v = swap(a, v); return v[0] + a; }',
        [uniform(1)]
      );
      expect(glsl).toContain('sl0_swap_results sl0_swap ( int p0, int[2] p1 )');
      expect(glsl).toMatch(/struct sl0_swap_results \{\s*int\[2\] m0;\s*int m1;\s*\}/);
    });

    it('passes and gives back a vector array whole, with no array constructor around it', () => {
      const glsl = glslOf(
        'void fill(vec2 v[2], out vec2 w[2]) { w = v; } vec2 probe(vec2 a) { vec2 v[2] = vec2[2](a, a); vec2 w[2]; fill(v, w); return w[1]; }',
        [uniform(new Vector2(1, 2))]
      );
      expect(glsl).not.toMatch(/vec2\[2\]\( nodeVar\d+ \)/);
    });

    it('reads an element of a vector array parameter as the vector', () => {
      const glsl = glslOf(
        'int second(ivec4 v[2]) { return v[1].y; } int probe(int a) { ivec4 v[2] = ivec4[2](ivec4(a), ivec4(a)); return second(v); }',
        [uniform(1)]
      );
      expect(glsl).toContain('return p0[ 1 ].y;');
    });

    it('stands a call of a function that gives back nothing as a statement', () => {
      const glsl = glslOf(
        'void stop(float x) { if (x < 0.0) discard; } float probe(float a) { stop(a); return a; }',
        [uniform(1)]
      );
      expect(glsl).toMatch(/nodeVar\d+ = sl0_stop\( /);
    });

    it('keeps a call of a struct function that stands as a statement', () => {
      const glsl = glslOf(
        'struct P { float a; float b; }; P kept(float x) { if (x < 0.0) discard; return P(x, x); } float probe(float a) { kept(a); return a; }',
        [uniform(1)]
      );
      expect(glsl).toMatch(/= sl0_kept\( /);
    });

    it('keeps a call of a value function that stands as a statement', () => {
      const glsl = glslOf(
        'float kept(float x) { if (x < 0.0) discard; return x; } float probe(float a) { kept(a); return a; }',
        [uniform(1)]
      );
      expect(glsl).toMatch(/nodeVar\d+ = sl0_kept\( /);
    });

    it('refuses an out argument whose swizzle repeats a letter, as the GPU compiler does', () => {
      expect(() =>
        transpileShadingLanguage(
          'void h(out float x) { x = 1.0; } float probe(vec2 a) { h(a.xx.x); return a.x; }'
        )
      ).toThrow('glslang refuses a swizzle that repeats a letter as an out or inout argument');
    });

    it.each([
      ['struct P { float a; }; float probe(P p) { return p.a; }', 'its argument p is in P'],
      ['float probe(float v[2]) { return v[0]; }', 'its argument v is in float[2]'],
      ['void probe(out float x) { x = 1.0; }', 'its argument x is out float'],
      ['float[2] probe(float x) { return float[2](x, x); }', 'it returns float[2]'],
    ])('refuses to call %s with one node per argument', (source, misfit) => {
      const probe = transpileShadingLanguage(source).functions.get('probe')!;
      expect(() => probe.call([uniform(1)])).toThrow(
        `expected probe to take and give one node each, but ${misfit}`
      );
    });

    it.each([
      [
        'a member of a call',
        'vec2 g() { return vec2(1.0); } void h(out float x) { x = 1.0; } float probe(vec2 a) { h(g().x); return a.x; }',
      ],
      [
        'a member of a sum',
        'void h(inout float x) { x += 1.0; } float probe(vec2 a, vec2 b) { h((a + b).x); return a.x; }',
      ],
    ])('refuses %s as an out argument, as the GPU compiler does', (_, source) => {
      expect(() => transpileShadingLanguage(source)).toThrow(
        'glslang refuses a value that is no variable as an out or inout argument'
      );
    });
  });
});
