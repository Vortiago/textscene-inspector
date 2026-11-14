/** The parser, against the types, the folds and the messages of Godot's `_parse_expression` and `_parse_block`. */

import { describe, expect, it } from 'vitest';
import { returnedValue as resultOf } from './parsedTree.testkit.js';
import { parse } from './parse.js';
import type { Expression, Statement } from './shaderTree.js';
import { tokenize } from './tokenizer.js';

const statementsOf = (source: string): readonly Statement[] =>
  parse(tokenize(source)).functions[0]!.body.statements;

const refusal = (source: string) => () => parse(tokenize(source));

/** The operators of a tree, without types: `['OP_SUB', 'a', ['OP_MUL', 'b', 'a']]`. */
function shapeOf(node: Expression): unknown {
  switch (node.kind) {
    case 'operator':
      return [node.op, ...node.operands.map(shapeOf)];
    case 'variable':
      return node.name;
    case 'member':
      return [`.${node.name}`, shapeOf(node.owner)];
    case 'constant':
      return node.values.length === 1 ? node.values[0] : node.values;
  }
}

describe('parse: functions', () => {
  it('reads a function head', () => {
    const [probe] = parse(tokenize('vec3 probe(vec3 a, float b) { return a; }')).functions;
    expect([probe?.name, probe?.returnType, probe?.arguments.map(({ name, type }) => [name, type])]).toEqual([
      'probe',
      'vec3',
      [
        ['a', 'vec3'],
        ['b', 'float'],
      ],
    ]);
  });

  it('accepts a comma before the closing parenthesis, as Godot does', () => {
    expect(parse(tokenize('float f(float a,) { return a; }')).functions[0]!.arguments).toHaveLength(1);
  });

  it('reads expression statements, and statements after a return', () => {
    expect(statementsOf('float f(float a) { a; ; return a; a; }').map((statement) => statement.kind)).toEqual(
      ['variable', 'operator', 'control flow', 'variable']
    );
  });

  it.each([
    ['float f(float a) { a = 1.0; }', "Expected at least one 'return' statement in a non-void function."],
    ['float f(float a) { return; }', "Expected 'return' with an expression of type 'float'."],
    ['void f(float a) { return a; }', "'void' function cannot return a value."],
    ['vec2 f(vec3 a) { return a; }', "Expected return with an expression of type 'vec2'."],
    ['float f(float a) { return a }', "Expected a ';' after 'return'."],
    ['float f(float a) { a return a; }', "Expected a ';'."],
    ['float f(float a) return a;', "Expected a '{' to begin function."],
    ['float (float a) { return a; }', 'Expected a function name after type.'],
    ['void f;', "Expected '(' after function identifier."],
    ['float f(float a float b) { return a; }', "Expected a ',' or ')'."],
    ['float f(void a) { return 1.0; }', 'Void type not allowed as argument.'],
    ['float f(float) { return 1.0; }', 'Expected an identifier for argument name.'],
    ['float f(a) { return 1.0; }', 'Expected a valid data type for argument.'],
    ['float f(float a, float a) { return a; }', "Redefinition of 'a'."],
    ['float f(float a) { return a; }\nfloat f(float b) { return b; }', "Redefinition of 'f'."],
    ['lowp bool f() { return true; }', 'The precision modifier cannot be used on boolean types.'],
    ['sampler2D f() { return 1.0; }', 'Invalid function type (samplers are not allowed).'],
    ['x', 'Expected constant, function, uniform or varying.'],
  ])('refuses %s with Godot message', (source, message) => {
    expect(refusal(source)).toThrow(message);
  });

  it('names the line and the column of a failure', () => {
    expect(refusal('float f()\n{\n  return b;\n}')).toThrow(/^3:10: Unknown identifier/);
  });

  it('names the line of the token Godot read last', () => {
    expect(refusal('float f(vec3 a, vec2 b) {\n  return a\n  + b;\n}')).toThrow(
      /^3:5: Invalid arguments to operator/
    );
  });
});

describe('parse: operators', () => {
  it('types an operator by its row of the instruction table', () => {
    const result = resultOf('vec3 f(vec3 a, float b) { return a * b; }');
    expect(result.kind === 'operator' && [result.row.id, result.type]).toEqual([
      'OP_MUL(vec3,float)',
      'vec3',
    ]);
  });

  it('binds * before + and reads left to right', () => {
    expect(shapeOf(resultOf('float f(float a, float b) { return a - b * a - b; }'))).toEqual([
      'OP_SUB',
      ['OP_SUB', 'a', ['OP_MUL', 'b', 'a']],
      'b',
    ]);
  });

  it.each([
    ['a < b == c', ['OP_EQUAL', ['OP_LESS', 'a', 'b'], 'c']],
    ['c && d || c && d', ['OP_OR', ['OP_AND', 'c', 'd'], ['OP_AND', 'c', 'd']]],
    ['i & j ^ i | j', ['OP_BIT_OR', ['OP_BIT_XOR', ['OP_BIT_AND', 'i', 'j'], 'i'], 'j']],
    ['i << j + i', ['OP_SHIFT_LEFT', 'i', ['OP_ADD', 'j', 'i']]],
  ])('reduces %s by Godot priorities', (expression, shape) => {
    const source = `bool f(float a, float b, bool c, bool d, int i, int j) { ${expression}; return c; }`;
    expect(shapeOf(statementsOf(source)[0] as Expression)).toEqual(shape);
  });

  it('applies unary operators right to left, before a binary operator and after a swizzle', () => {
    expect(shapeOf(resultOf('float f(vec2 a) { return - -a.x * 2.0; }'))).toEqual([
      'OP_MUL',
      ['OP_NEGATE', ['OP_NEGATE', ['.x', 'a']]],
      2,
    ]);
  });

  it('skips a unary plus', () => {
    expect(shapeOf(resultOf('float f(float a) { return +a; }'))).toBe('a');
  });

  it('reads a ternary, whose else part reaches to the end', () => {
    expect(shapeOf(resultOf('float f(bool c, float a) { return c ? a : a + a; }'))).toEqual([
      'OP_SELECT_IF',
      'c',
      'a',
      ['OP_ADD', 'a', 'a'],
    ]);
  });

  it('reads a ternary inside the then part of another', () => {
    expect(shapeOf(resultOf('float f(bool c, float a) { return c ? c ? a : -a : a; }'))).toEqual([
      'OP_SELECT_IF',
      'c',
      ['OP_SELECT_IF', 'c', 'a', ['OP_NEGATE', 'a']],
      'a',
    ]);
  });

  it('reads assignments left to right, as Godot reduces them', () => {
    expect(
      shapeOf(statementsOf('float f(float a, float b) { a = b = 1.0; return a; }')[0] as Expression)
    ).toEqual(['OP_ASSIGN', ['OP_ASSIGN', 'a', 'b'], 1]);
  });

  it.each([
    ['vec3 f(vec3 a, vec2 b) { return a + b; }', "Invalid arguments to operator '+': 'vec3, vec2'."],
    ['float f(bool a) { return -a; }', "Invalid arguments to unary operator '-': bool."],
    [
      'float f(float a) { return a ? a : a; }',
      "Invalid argument to ternary operator: 'float, float, float'.",
    ],
    ['float f(float a) { return a ! a; }', "Invalid token for the operator: 'OP_NOT'."],
    ['float f(float a) { 1.0 = a; return a; }', 'Assignment to constant expression.'],
    ['float f(vec2 a) { a.xx = a; return a.x; }', 'Swizzling assignment contains duplicates.'],
    ['float f(float a) { (a + a)++; return a; }', 'Assignment to constant expression.'],
    ['float f(bool a) { a++; return 1.0; }', 'Invalid base type for increment/decrement operator.'],
    ['float f(float a) { return void; }', 'Void value not allowed in expression.'],
    ['float f(float a) { return ); }', "Expected expression, found: 'PARENTHESIS_CLOSE'."],
    ['float f(float a) { return (a; }', "Expected ')' in expression."],
    ['float f(float a) { return b; }', "Unknown identifier in expression: 'b'."],
    ['float g() { return 1.0; } float f() { return g; }', "Can't use function as identifier: 'g'."],
  ])('refuses %s with Godot message', (source, message) => {
    expect(refusal(source)).toThrow(message);
  });
});

describe('parse: operands', () => {
  it('picks the first constructor overload of the argument types', () => {
    const result = resultOf('vec4 f(vec2 a, float b) { return vec4(b, a, b); }');
    expect(result.kind === 'operator' && [result.op, result.row.id]).toEqual([
      'OP_CONSTRUCT',
      'vec4(float,vec2,float)',
    ]);
  });

  it('converts a scalar constant to the type an overload takes, as Godot does', () => {
    const result = resultOf('vec2 f(float a) { return vec2(1, a); }');
    expect(result.kind === 'operator' && result.operands[0]).toMatchObject({
      kind: 'constant',
      type: 'float',
      values: [1],
    });
  });

  it('keeps a conversion Godot does not fold, int(1.5)', () => {
    expect(shapeOf(resultOf('int f() { return int(1.5); }'))).toEqual(['OP_CONSTRUCT', 1.5]);
  });

  it.each([
    ['vec2 f() { return -vec2(1.5, -0.25); }', 'vec2', [-1.5, 0.25]],
    ['mat2 f() { return mat2(2.0); }', 'mat2', [2, 0, 0, 2]],
    ['uvec2 f() { return uvec2(1, 2u); }', 'uvec2', [1, 2]],
    ['int f() { return -2147483648; }', 'int', [-2147483648]],
    ['uint f() { return -1u; }', 'uint', [4294967295]],
    ['bvec2 f() { return bvec2(true, false); }', 'bvec2', [true, false]],
  ])('folds %s into one constant, as Godot does', (source, type, values) => {
    expect(resultOf(source)).toMatchObject({ kind: 'constant', type, values });
  });

  it('keeps a negation that is not the top of a whole expression, as Godot does', () => {
    expect(shapeOf(resultOf('float f(float a) { return -(-1.5) + a; }'))).toEqual([
      'OP_ADD',
      ['OP_NEGATE', -1.5],
      'a',
    ]);
  });

  it('negates a negated constant twice in a ternary part, as Godot does', () => {
    expect(shapeOf(resultOf('vec2 f(bool c) { return c ? -vec2(1.0, 2.0) : vec2(0.0); }'))).toEqual([
      'OP_SELECT_IF',
      'c',
      ['OP_NEGATE', [-1, -2]],
      [0, 0],
    ]);
  });

  it('keeps the 32-bit float Godot holds for a literal, before its text loses digits', () => {
    const result = resultOf('float f() { return 1.5e-14; }');
    const value = result.kind === 'constant' ? (result.values[0] as number) : NaN;
    expect(new Uint32Array(new Float32Array([value]).buffer)[0]).toBe(0x28871ba5);
  });

  it('refuses a literal that Godot writes as text no GLSL compiler reads', () => {
    expect(refusal('float f() { return 1e39; }')).toThrow(/^1:20: float literal '1e39'.*inf/);
  });

  it.each([
    ['vec3 f(vec2 a) { return vec3(a); }', "No matching constructor found for: 'vec3'."],
    ['vec2 f(int a) { return vec2(a); }', "No matching constructor found for: 'vec2'."],
    ['uvec2 f() { return uvec2(-1, 1); }', "No matching constructor found for: 'uvec2'."],
    ['vec2 f() { return vec2 1.0; }', "Expected '(' after the type name."],
    ['vec2 f(float a) { return vec2(a a); }', "Expected ',' or ')' after argument."],
  ])('refuses %s with Godot message', (source, message) => {
    expect(refusal(source)).toThrow(message);
  });
});

describe('parse: members and indexes', () => {
  it('reads a swizzle of any scalar kind, typed by its length', () => {
    const result = resultOf('ivec3 f(ivec4 a) { return a.bgr; }');
    expect(result.kind === 'member' && [result.row.id, result.name, result.type]).toEqual([
      'ivec4.rgba',
      'bgr',
      'ivec3',
    ]);
  });

  it('reads an index of a vector and of a matrix', () => {
    expect([
      resultOf('float f(vec3 a, int i) { return a[i]; }').type,
      resultOf('vec2 f(mat2 m) { return m[1]; }').type,
    ]).toEqual(['float', 'vec2']);
  });

  it.each([
    ['vec2 f(vec2 a) { return a.xg; }', "Cannot combine symbols from different sets in expression '.xg'."],
    ['float f(vec2 a) { return a.z; }', "Invalid member for 'vec2' expression: '.z'."],
    ['float f(float a) { return a.x; }', "Invalid member for 'float' expression: '.x'."],
    ['vec4 f(vec4 a) { return a.xyzwx; }', "Invalid member for 'vec4' expression: '.xyzwx'."],
    ['float f(vec2 a) { return a.+a.x; }', 'Expected an identifier as a member.'],
    ['float f(vec2 a) { return a[1.0]; }', 'Only integer expressions are allowed for indexing.'],
    ['float f(vec2 a) { return a[2]; }', 'Index [2] out of range [0..1].'],
    ['float f(vec2 a) { return a[-1]; }', 'Index [4294967295] out of range [0..1].'],
    ['float f(float a) { return a[0]; }', "An object of type 'float' can't be indexed."],
    ['float f(vec2 a) { return a[0; }', "Expected a ']'."],
  ])('refuses %s with Godot message', (source, message) => {
    expect(refusal(source)).toThrow(message);
  });
});

describe('parse: whole arrays', () => {
  it.each([
    [
      'float f(float a) { float v[2]; return a + v; }',
      "Invalid arguments to operator '+': 'float, float[2]'.",
    ],
    [
      'float f(float a) { float v[2]; float x; x = v; return x; }',
      "Invalid arguments to operator '=': 'float, float[2]'.",
    ],
    [
      'struct P { float x; }; float f(float a) { P p; P q[2]; p = q; return a; }',
      "Invalid arguments to operator '=': 'P, P[2]'.",
    ],
    ['float f(float a) { return float[2](a, a); }', "Expected return with an expression of type 'float'."],
  ])('refuses %s with Godot message', (source, message) => {
    expect(refusal(source)).toThrow(message);
  });
});

describe('parse: what the transpiler does not read yet', () => {
  it.each([
    ['shader_type canvas_item;', "'shader_type' is not transpiled yet (#1794)"],
    ['uniform float u;', "'uniform' is not transpiled yet (#1829)"],
    ['float f(float a) { return sin(a); }', "'sin(float)' is not transpiled yet (#1826)"],
    ['float f() { return TIME; }', "'TIME' is not transpiled yet (#1794)"],
  ])('names the issue that owns %s', (source, message) => {
    expect(refusal(source)).toThrow(message);
  });
});
