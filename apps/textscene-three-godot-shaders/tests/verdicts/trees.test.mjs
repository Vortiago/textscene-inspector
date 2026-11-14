/**
 * The tree checks the harness runs over the random programs fail on a broken tree: each case
 * breaks one fact by hand and names the message the check gives.
 */

import { describe, expect, it } from 'vitest';
import { treeFault } from '../../../../packages/textscene-core/src/shaders/language/treeCheck.ts';
import { loweredFault, loweredTreeOf, treeOf } from './trees.testkit.mjs';

/** `tree` with the value of its first function's last `return` replaced by `change(value)`. */
function withReturnedValue(tree, change) {
  const [definition] = tree.functions;
  const statements = definition.body.statements.map((statement) =>
    statement.kind === 'control flow' && statement.flow === 'FLOW_OP_RETURN'
      ? { ...statement, expressions: [change(statement.expressions[0])] }
      : statement
  );
  return { ...tree, functions: [{ ...definition, body: { ...definition.body, statements } }] };
}

const SUM = 'vec2 f(vec2 a, vec2 b) { return a + b; }';

describe('the tree check on a broken tree', () => {
  it('passes the tree it is given whole', () => {
    expect(treeFault(treeOf(SUM))).toBeUndefined();
  });

  it('finds an operand of another type than its row', () => {
    const tree = withReturnedValue(treeOf(SUM), (sum) => ({
      ...sum,
      operands: [{ ...sum.operands[0], type: 'vec3' }, sum.operands[1]],
    }));
    expect(treeFault(tree)).toMatch(/^f: the name a read as vec3/);
  });

  it('finds an operator with an operand missing', () => {
    const tree = withReturnedValue(treeOf(SUM), (sum) => ({ ...sum, operands: [sum.operands[0]] }));
    expect(treeFault(tree)).toBe('f: the row OP_ADD(vec2,vec2) over vec2');
  });
});

describe('the lowered tree check', () => {
  const LOOPS = 'float f(float a) { for (int i = 0; i < 2; i++) { a += 1.0; } return a; }';
  const SWITCH = 'int f(int a) { switch (a) { case 1: return 2; default: return 3; } }';
  const WHILE = 'float f(float a) { while (a < 1.0) { a += 1.0; } return a; }';

  it('passes a lowered tree', () => {
    for (const source of [LOOPS, SWITCH, WHILE]) expect(loweredFault(loweredTreeOf(source))).toBeUndefined();
  });

  it('finds a for loop the lowering should have removed', () => {
    expect(loweredFault(treeOf(LOOPS))).toBe('f: a for loop after lowering');
  });

  it('finds a switch the lowering should have removed', () => {
    expect(loweredFault(treeOf(SWITCH))).toBe('f: a switch after lowering');
  });

  it('finds a while loop that still has its condition', () => {
    expect(loweredFault(treeOf(WHILE))).toBe('f: a while loop with a condition after lowering');
  });
});
