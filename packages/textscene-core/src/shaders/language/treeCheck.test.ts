/** The tree check finds a node that breaks a fact of the tree. */

import { describe, expect, it } from 'vitest';
import { treeOf } from './parsedTree.testkit.js';
import type { CallNode, Expression, FunctionNode, OperatorNode, ShaderNode } from './shaderTree.js';
import { treeFault } from './treeCheck.js';

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
      ...(value as OperatorNode),
      op: 'OP_SHIFT_LEFT',
    }));
    expect(treeFault(tree)).toMatch(/the row OP_ADD\(vec2,vec2\) over vec2, vec2/);
  });

  it('finds a return of another type than its function', () => {
    const tree = withReturn(
      treeOf('vec2 f(vec2 a, vec2 b) { return a + b; }'),
      (value) => ({ ...value, type: 'vec3' }) as Expression
    );
    expect(treeFault(tree)).toMatch(/return of vec3 in a function of vec2/);
  });

  it('finds a node with no line and column of its text', () => {
    const tree = withReturn(treeOf('float f(float a) { return a; }'), (value) => ({
      ...value,
      position: { file: '', line: 0, column: 0 },
    }));
    expect(treeFault(tree)).toMatch(/a variable at no line and column/);
  });

  it('finds a name that is no argument', () => {
    const tree = withReturn(
      treeOf('float f(float a) { return a; }'),
      (value) => ({ ...value, name: 'b' }) as Expression
    );
    expect(treeFault(tree)).toMatch(/the name b, which no block around the read declares/);
  });

  it('finds a constant lane outside its type', () => {
    const tree = withReturn(
      treeOf('int f() { return 1; }'),
      (value) => ({ ...value, values: [2 ** 31] }) as Expression
    );
    expect(treeFault(tree)).toMatch(/int constant 2147483648/);
  });

  describe('a call', () => {
    const source = 'float twice(float x) { return x * 2.0; } float f(float a) { twice(a); return a; }';

    /** `source` with the call that is the first statement of `f` changed by `change`. */
    function withCall(change: (call: CallNode) => Expression): ShaderNode {
      const shader = treeOf(source);
      const [twice, f] = shader.functions as [FunctionNode, FunctionNode];
      const [call, ...rest] = f.body.statements;
      const body = { ...f.body, statements: [change(call as CallNode), ...rest] };
      return { ...shader, functions: [twice, { ...f, body }] };
    }

    it('finds no fault in a parsed call', () => {
      expect(treeFault(treeOf(source))).toBeUndefined();
    });

    it('finds a call of no function before its caller', () => {
      expect(treeFault(withCall((call) => ({ ...call, function: 'later' })))).toMatch(
        /a call of later, which no function before f is/
      );
    });

    it('finds a call at no line and column', () => {
      expect(
        treeFault(withCall((call) => ({ ...call, position: { ...call.position, line: 0, column: 0 } })))
      ).toMatch(/a call of twice at no line and column/);
    });

    it('finds a call typed otherwise than its function returns', () => {
      expect(treeFault(withCall((call) => ({ ...call, type: 'int' })))).toMatch(/a call of twice typed int/);
    });

    it('finds an argument of another type than its parameter', () => {
      const constant = { kind: 'constant', type: 'int', values: [1] } as const;
      expect(
        treeFault(withCall((call) => ({ ...call, operands: [{ ...call.operands[0]!, ...constant }] })))
      ).toMatch(/a int for the argument x of twice/);
    });
  });
});
