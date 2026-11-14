/** The parameters, the overloads and the calls of a shader's functions, against Godot's messages. */

import { describe, expect, it } from 'vitest';
import { parse } from './parse.js';
import type { CallNode, Expression, FunctionNode } from './shaderTree.js';
import { tokenize } from './tokenizer.js';
import { everyExpressionIn, isCall } from './treeWalk.js';

const functionsOf = (source: string): readonly FunctionNode[] => parse(tokenize(source)).functions;

/** The calls of the last function of `source`, in the order of the text. */
const callsOf = (source: string): CallNode[] =>
  [...everyExpressionIn(functionsOf(source).at(-1)!.body)].filter(isCall);

const refusal = (source: string) => () => parse(tokenize(source));

describe('parse: parameters', () => {
  it('reads each qualifier, in by default', () => {
    const [f] = functionsOf('void f(float a, in float b, out float c, inout float d) { }');
    expect(f!.arguments.map((argument) => argument.qualifier)).toEqual(['in', 'in', 'out', 'inout']);
  });

  it('reads a const parameter', () => {
    const [f] = functionsOf('float f(const in float a) { return a; }');
    expect(f!.arguments[0]).toMatchObject({ qualifier: 'in', isConst: true });
  });

  it('reads an array size before the name and after it', () => {
    const [f] = functionsOf('int f(int[2] a, int b[3]) { return a[0] + b[2]; }');
    expect(f!.arguments.map((argument) => argument.arraySize)).toEqual([2, 3]);
  });

  it('reads struct parameters and returns, and array returns', () => {
    const functions = functionsOf(
      'struct P { float x; }; P f(P p) { return p; } float[2] g(float a) { return float[2](a, a); }'
    );
    expect(functions.map((each) => [each.returnType, each.returnArraySize, each.arguments[0]!.type])).toEqual(
      [
        ['P', undefined, 'P'],
        ['float', 2, 'float'],
      ]
    );
  });

  it.each([
    [
      'void f(const out float x) { }',
      "The 'out' qualifier cannot be used within a function parameter declared with 'const'.",
    ],
    [
      'void f(const inout float x) { }',
      "The 'inout' qualifier cannot be used within a function parameter declared with 'const'.",
    ],
    ['void f(out in float x) { }', 'Expected a valid data type for argument.'],
    ['float f(void x) { return 1.0; }', 'Void type not allowed as argument.'],
    ['const float f(float x) { return x; }', "'const' qualifier cannot be used with a function return type."],
    ['float f(const float x) { x = 1.0; return x; }', 'Constants cannot be modified.'],
  ])('refuses %s with Godot message', (source, message) => {
    expect(refusal(source)).toThrow(message);
  });
});

describe('parse: overloads', () => {
  it("names the second function of a name as Godot does, and keeps the text's name", () => {
    const functions = functionsOf('float f(float x) { return x; } vec2 f(vec2 x) { return x; }');
    expect(functions.map((each) => [each.name, each.rname])).toEqual([
      ['f', 'f'],
      ['f@2', 'f'],
    ]);
  });

  it('refuses a second function of the same argument types, whatever it returns', () => {
    expect(refusal('float f(float x) { return x; } int f(float y) { return 1; }')).toThrow(
      "Redefinition of 'f'."
    );
  });

  it('calls the overload of the argument types', () => {
    const calls = callsOf(
      'float f(float x) { return x; } vec2 f(vec2 x) { return x; } float g(float a) { return f(a) + f(vec2(a)).y; }'
    );
    expect(calls.map((call) => [call.function, call.type])).toEqual([
      ['f', 'float'],
      ['f@2', 'vec2'],
    ]);
  });
});

describe('parse: calls', () => {
  it('types a call by the return type and array size of its function', () => {
    const [call] = callsOf(
      'float[2] p(float a) { return float[2](a, a); } float g(float a) { float v[2] = p(a); return v[0]; }'
    );
    expect([call!.type, call!.arraySize]).toEqual(['float', 2]);
  });

  it('converts a scalar constant to the parameter type when the function has no overload', () => {
    const [call] = callsOf('float t(float x) { return x; } float g(float a) { return t(3) + a; }');
    expect(call!.operands[0]).toMatchObject({ kind: 'constant', type: 'float', values: [3] });
  });

  it('passes a variable, an element and a member to an out parameter', () => {
    const calls = callsOf(
      'void s(out float x) { x = 1.0; } float g(vec2 v) { float a; float b[2]; s(a); s(b[1]); s(v.y); return a; }'
    );
    expect(calls.map((call) => (call.operands[0] as Expression).kind)).toEqual([
      'variable',
      'array element',
      'member',
    ]);
  });

  it.each([
    ['int down(int a) { return down(a - 1); }', 'Recursion is not allowed.'],
    [
      'float g(float a) { return later(a); } float later(float x) { return x; }',
      "No matching function found for: 'later'.",
    ],
    [
      'float t(float x) { return x; } float g(float a) { return t(); }',
      'Too few arguments for "t(float)" call. Expected at least 1 but received 0.',
    ],
    [
      'float t(float x) { return x; } float g(float a) { return t(a, a); }',
      'Too many arguments for "t(float)" call. Expected at most 1 but received 2.',
    ],
    [
      'float t(float x) { return x; } float g(int a) { return t(a); }',
      'No matching function for "t(float)" call: argument 1 should be float but is int.',
    ],
    [
      'float f(float x) { return x; } vec2 f(vec2 x) { return x; } float g(float a) { return f(2) + a; }',
      'No matching function for "f" call:\n\tcandidate function "f(float)" not viable, argument 1 should be float but is int.\n\tcandidate function "f(vec2)" not viable, argument 1 should be vec2 but is int.',
    ],
    [
      'int s(int v[2]) { return v[0]; } int g(int a) { int v[3]; return s(v); }',
      'No matching function for "s(int[2])" call: argument 1 should be int[2] but is int[3].',
    ],
    [
      'void s(out float x) { x = 1.0; } float g(float a) { s(1.0); return a; }',
      "A constant value cannot be passed for the 'out' parameter.",
    ],
    [
      'void s(inout float x) { } float g(float a) { s(a + 1.0); return a; }',
      "A constant value cannot be passed for the 'inout' parameter.",
    ],
    [
      'void s(out float x) { x = 1.0; } float g(float a) { const float k = 1.0; s(k); return a; }',
      "A constant value cannot be passed for the 'out' parameter.",
    ],
    [
      'float t(float x) { return x; } float g(float a) { float t = a; return t(a); }',
      'Expected a function name.',
    ],
    [
      'void n() { } float g(float a) { float b = n(); return a; }',
      "Invalid assignment of 'void' to 'float'.",
    ],
    ['struct S { float a[n()]; }; int n() { return 2; }', "No matching function found for: 'n'."],
    ['int n() { return 2; } struct S { float a[n()]; };', 'Expected a positive integer constant.'],
    ['int n() { return 2; } float g(float a[n()]) { return a[0]; }', 'Expected a positive integer constant.'],
    [
      'int n() { return 2; } float[n()] g(float x) { float r[2]; return r; }',
      'Expected a positive integer constant.',
    ],
  ])('refuses %s with Godot message', (source, message) => {
    expect(refusal(source)).toThrow(message);
  });

  it('names the line of the closing parenthesis, where Godot reports a call', () => {
    expect(refusal('float g(float a) {\n  return missing(a\n  );\n}')).toThrow(
      /^3:3: No matching function found/
    );
  });
});
