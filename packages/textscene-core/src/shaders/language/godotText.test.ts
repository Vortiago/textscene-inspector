/** The tree GLSL reads from Godot's text, on parsed trees. */

import { describe, expect, it } from 'vitest';
import { treeOf } from './parsedTree.testkit.js';
import { glslBlock } from './godotText.js';
import type { Expression } from './shaderTree.js';

/** A tree as nested calls: `OP_ASSIGN(a, OP_MUL(b, a))`. */
function written(expression: Expression): string {
  switch (expression.kind) {
    case 'constant':
      return expression.values.join(',');
    case 'variable':
      return expression.name;
    case 'member':
      return `${written(expression.owner)}.${expression.name}`;
    case 'operator':
      return `${expression.op}(${expression.operands.map(written).join(', ')})`;
    default:
      throw new Error(`expected an expression of the operator chapters, got a ${expression.kind}`);
  }
}

/** The value of the first `return` of `source`'s first function, as GLSL reads it. */
function glslReturnOf(source: string): Expression {
  const body = glslBlock(treeOf(source).functions[0]!.body);
  const statement = body.statements.find((candidate) => candidate.kind === 'control flow');
  if (statement?.kind !== 'control flow') throw new Error(`expected a return in ${source}`);
  return statement.expressions[0]!;
}

const glslOf = (source: string) => written(glslReturnOf(source));

describe('glslBlock', () => {
  it.each([
    ['a negation', 'float f(float a) { return -(-a); }', 'OP_NEGATE(a)'],
    ['a swizzle of a negation', 'float f(vec2 a) { return -((-a).y); }', 'OP_NEGATE(a).y'],
    ['a pre-decrement', 'int f(int a) { return -(--a); }', 'OP_DECREMENT(a)'],
    ['an element of a negation', 'float f(vec2 a) { return -(-a)[1]; }', 'OP_INDEX(OP_NEGATE(a), 1)'],
  ])('drops the negation of %s, whose text starts with a minus', (_, source, tree) => {
    expect(glslOf(source)).toBe(tree);
  });

  it('keeps the negation of a sum, whose text starts with a bracket', () => {
    expect(glslOf('float f(float a, float b) { return -(a + b); }')).toBe('OP_NEGATE(OP_ADD(a, b))');
  });

  it('binds an operator after an assignment to the assignment value', () => {
    expect(glslOf('vec2 f(vec2 a, vec2 b) { return (a = b) * a; }')).toBe('OP_ASSIGN(a, OP_MUL(b, a))');
  });

  it('reads a chain Godot reduces from the left as GLSL does, from the right', () => {
    expect(glslOf('int f(int a, int b) { return a = b = a + b; }')).toBe(
      'OP_ASSIGN(a, OP_ASSIGN(b, OP_ADD(a, b)))'
    );
  });

  it('binds a swizzle of a pre-increment to the incremented argument', () => {
    expect(glslOf('float f(vec2 a) { return (++a).x; }')).toBe('OP_INCREMENT(a.x)');
  });

  it('binds a ternary condition that is an assignment to the assigned value', () => {
    expect(glslOf('bool f(bool c, bool d, bool a) { return (c = d) ? a : !a; }')).toBe(
      'OP_ASSIGN(c, OP_SELECT_IF(d, a, OP_NOT(a)))'
    );
  });

  it.each([
    ['an assignment on the right of an operator', 'vec2 f(vec2 a, vec2 b) { return b * (a = b); }'],
    ['a negated assignment', 'float f(float a, float b) { return -(a = b); }'],
    ['an assignment whose value no longer fits', 'vec2 f(vec2 a, vec2 b) { return (a = b) == a ? a : b; }'],
  ])('refuses %s, whose text GLSL refuses', (_, source) => {
    expect(() => glslReturnOf(source)).toThrow(/without brackets/);
  });
});
