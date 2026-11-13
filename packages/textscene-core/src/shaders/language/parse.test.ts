/** The parser, against the types and the messages of Godot's `_parse_expression` (`shader_language.cpp:6044`). */

import { describe, expect, it } from 'vitest';
import { parse } from './parse.js';
import type { Expression } from './shaderTree.js';
import { tokenize } from './tokenizer.js';

const resultOf = (source: string): Expression => parse(tokenize(source)).functions[0]!.result;
const refusal = (source: string) => () => parse(tokenize(source));

describe('parse', () => {
  it('reads a function head', () => {
    const [probe] = parse(tokenize('vec3 probe(vec3 a, float b) { return a; }')).functions;
    expect([probe?.name, probe?.returnType, probe?.parameters]).toEqual([
      'probe',
      'vec3',
      [
        { name: 'a', type: 'vec3' },
        { name: 'b', type: 'float' },
      ],
    ]);
  });

  it('types an operator by its row of the instruction table', () => {
    const result = resultOf('vec3 f(vec3 a, float b) { return a * b; }');
    expect(result.kind === 'operator' && [result.row.id, result.type]).toEqual([
      'OP_MUL(vec3,float)',
      'vec3',
    ]);
  });

  it('binds * before + and reads left to right', () => {
    const result = resultOf('float f(float a, float b) { return a - b * a - b; }');
    const shape = (node: Expression): unknown =>
      node.kind === 'operator' ? [node.row.id.slice(3, 6), ...node.operands.map(shape)] : node.kind;
    expect(shape(result)).toEqual([
      'SUB',
      ['SUB', 'parameter', ['MUL', 'parameter', 'parameter']],
      'parameter',
    ]);
  });

  it('binds unary minus before a binary operator and after a swizzle', () => {
    const result = resultOf('float f(vec2 a) { return -a.x * 2.0; }');
    expect(
      result.kind === 'operator' && result.operands[0]?.kind === 'operator' && result.operands[0].row.id
    ).toBe('OP_NEGATE(float)');
  });

  it('refuses operands no operator row takes, with Godot message', () => {
    expect(refusal('vec3 f(vec3 a, vec2 b) { return a + b; }')).toThrow(
      "Invalid arguments to operator '+': 'vec3, vec2'."
    );
  });

  it('picks the constructor overload of the argument types', () => {
    const result = resultOf('vec4 f(vec2 a, float b) { return vec4(b, a, b); }');
    expect(result.kind === 'constructor' && result.row.id).toBe('vec4(float,vec2,float)');
  });

  it('refuses a constructor with no overload for the arguments, with Godot message', () => {
    expect(refusal('vec3 f(vec2 a) { return vec3(a); }')).toThrow(
      "No matching constructor found for: 'vec3'."
    );
  });

  it('reads a swizzle as lanes of one letter set', () => {
    const result = resultOf('vec3 f(vec4 a) { return a.bgr; }');
    expect(result.kind === 'swizzle' && [result.row.id, result.lanes, result.type]).toEqual([
      'vec4.rgba',
      [2, 1, 0],
      'vec3',
    ]);
  });

  it('refuses a swizzle that mixes letter sets, with Godot message', () => {
    expect(refusal('vec2 f(vec2 a) { return a.xg; }')).toThrow(
      "Cannot combine symbols from different sets in expression '.xg'."
    );
  });

  it('refuses a swizzle letter past the vector, with Godot message', () => {
    expect(refusal('float f(vec2 a) { return a.z; }')).toThrow("Invalid member for 'vec2' expression: '.z'.");
  });

  it('keeps the float a literal draws with', () => {
    const result = resultOf('float f() { return 1.5e-14; }');
    const bits =
      result.kind === 'float literal' && new Uint32Array(new Float32Array([result.value]).buffer)[0];
    expect(bits).toBe(0x283424dc);
  });

  it('refuses a literal that Godot writes as text no GLSL compiler reads', () => {
    expect(refusal('float f() { return 1e39; }')).toThrow(/^line 1: float literal '1e39'.*inf/);
  });

  it('refuses a return of another type, with Godot message', () => {
    expect(refusal('vec2 f(vec3 a) { return a; }')).toThrow(
      "Expected return with an expression of type 'vec2'."
    );
  });

  it('refuses an unknown identifier, with Godot message', () => {
    expect(refusal('float f() { return b; }')).toThrow("Unknown identifier in expression: 'b'.");
  });

  it('refuses a second function of one signature, with Godot message', () => {
    expect(refusal('float f(float a) { return a; }\nfloat f(float b) { return b; }')).toThrow(
      "line 2: Redefinition of 'f'."
    );
  });

  it('refuses an overload, which a map of functions by name cannot hold', () => {
    expect(refusal('float f(float a) { return a; }\nvec2 f(vec2 a) { return a; }')).toThrow(
      "An overload of 'f' is not transpiled yet (#1825)"
    );
  });

  it('refuses a parameter name read twice, with Godot message', () => {
    expect(refusal('float f(float a, float a) { return a; }')).toThrow("Redefinition of 'a'.");
  });

  it('names the line of a refusal', () => {
    expect(refusal('float f()\n{\n  return b;\n}')).toThrow(/^line 3: /);
  });

  it.each([
    ['shader_type canvas_item;', "'shader_type' is not transpiled yet (#1794)"],
    ['uniform float u;', "'uniform' is not transpiled yet (#1829)"],
    ['int f() { return 1; }', "'int' is not transpiled yet (#1823)"],
    ['float f() { return 1; }', "'int literal' is not transpiled yet (#1823)"],
    ['float f(float a) { if (a) {} return a; }', "'if' is not transpiled yet (#1824)"],
    [
      'float f(float a) { float b = a; return b; }',
      "'NODE_TYPE_VARIABLE_DECLARATION' is not transpiled yet (#1824)",
    ],
    ['float f(out float a) { return a; }', "'out' is not transpiled yet (#1825)"],
    ['float f(float a) { return sin(a); }', "'sin(float)' is not transpiled yet (#1826)"],
    ['float f(float a) { return a % a; }', "'OP_MOD' is not transpiled yet (#1823)"],
    ['float f(float a) { return a < a ? a : a; }', "'OP_LESS(float,float)' is not transpiled yet (#1823)"],
    ['float f(float a) { return f(a); }', "'OP_CALL' is not transpiled yet (#1825)"],
    ['float f() { return TIME; }', "'TIME' is not transpiled yet (#1794)"],
  ])('names the issue that owns %s', (source, message) => {
    expect(refusal(source)).toThrow(message);
  });
});
