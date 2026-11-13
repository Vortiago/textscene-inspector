/** The tree check finds a node that breaks a fact of the tree. */

import { describe, expect, it } from 'vitest';
import { parse } from './parse.js';
import type { Expression, ShaderNode } from './shaderTree.js';
import { tokenize } from './tokenizer.js';
import { treeFault } from './treeCheck.js';

const treeOf = (source: string) => parse(tokenize(source));

/** `shader` with the value of its first function's return replaced by `change(value)`. */
function withReturn(shader: ShaderNode, change: (value: Expression) => Expression): ShaderNode {
  const definition = shader.functions[0]!;
  const statements = definition.body.statements.map((statement) =>
    statement.kind === 'control flow'
      ? { ...statement, expressions: [change(statement.expressions[0]!)] }
      : statement
  );
  return { ...shader, functions: [{ ...definition, body: { ...definition.body, statements } }] };
}

describe('treeFault', () => {
  it('finds no fault in a parsed tree', () => {
    expect(treeFault(treeOf('ivec2 f(ivec2 a, int b) { a.y += b; return a << 1; }'))).toBeUndefined();
  });

  it('finds an operator whose row does not fit its operand types', () => {
    const tree = withReturn(treeOf('vec2 f(vec2 a, vec2 b) { return a + b; }'), (value) => ({
      ...value,
      type: 'vec3',
    }));
    expect(treeFault(tree)).toMatch(/return of vec3 in a function of vec2/);
  });

  it('finds a name that is no argument', () => {
    const tree = withReturn(
      treeOf('float f(float a) { return a; }'),
      (value) => ({ ...value, name: 'b' }) as Expression
    );
    expect(treeFault(tree)).toMatch(/the name b is no argument/);
  });

  it('finds a constant lane outside its type', () => {
    const tree = withReturn(
      treeOf('int f() { return 1; }'),
      (value) => ({ ...value, values: [2 ** 31] }) as Expression
    );
    expect(treeFault(tree)).toMatch(/int constant 2147483648/);
  });
});
