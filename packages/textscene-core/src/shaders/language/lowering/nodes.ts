/**
 * The tree nodes a lowering writes: each one of Godot's own nodes, with its row, at the place of
 * the statement it lowers, so the lowered tree passes the tree check and Godot reads its text.
 */

import { signatureInstruction } from '../instructions.js';
import type { SourcePosition } from '../shadingLanguageError.js';
import type {
  BlockNode,
  ControlFlowNode,
  DeclarationNode,
  Expression,
  Flow,
  OperatorNode,
  Statement,
  VariableNode,
} from '../shaderTree.js';

/** A read of `name`, an array of `arraySize` elements when it is above zero. */
export const variable = (
  name: string,
  type: string,
  position: SourcePosition,
  arraySize = 0
): VariableNode => ({ kind: 'variable', type, name, position, ...(arraySize > 0 ? { arraySize } : {}) });

export const boolean = (value: boolean, position: SourcePosition): Expression => ({
  kind: 'constant',
  type: 'bool',
  values: [value],
  position,
});

/** The operator `op` over `operands`, typed by its row. */
export function operator(
  op: string,
  operands: readonly Expression[],
  position: SourcePosition
): OperatorNode {
  const types = operands.map((operand) => operand.type);
  const row = signatureInstruction(op, types);
  if (!row) throw new Error(`expected a row ${op}(${types.join(',')}) for a lowering`);
  return { kind: 'operator', type: row.returns!, op, row, operands, position };
}

export const assign = (target: VariableNode, value: Expression): OperatorNode =>
  operator('OP_ASSIGN', [target, value], target.position);

export const not = (value: Expression): OperatorNode => operator('OP_NOT', [value], value.position);

/** `type name = value;`, or `type name;` with no value, and `type name[arraySize]` for an array. */
export function declaration(
  name: string,
  type: string,
  value: Expression | undefined,
  position: SourcePosition,
  arraySize = 0
): DeclarationNode {
  const sized = arraySize > 0 ? { arraySize } : {};
  return {
    kind: 'declaration',
    type,
    isConst: false,
    declarators: [{ name, position, ...sized, ...(value ? { value } : {}) }],
    position,
  };
}

export const block = (statements: readonly Statement[], position: SourcePosition): BlockNode => ({
  kind: 'block',
  statements,
  position,
});

export const flow = (
  op: Flow,
  expressions: readonly Expression[],
  blocks: readonly BlockNode[],
  position: SourcePosition
): ControlFlowNode => ({ kind: 'control flow', flow: op, expressions, blocks, position });

/**
 * The body of an `if` or a loop as Godot holds it: a block of one statement, which is a block
 * itself for more than one.
 */
export const flowBody = (statements: readonly Statement[], position: SourcePosition): BlockNode =>
  block(statements.length === 1 ? statements : [block(statements, position)], position);

/** `if (condition) { then }`. */
export const ifStatement = (
  condition: Expression,
  then: readonly Statement[],
  position: SourcePosition
): ControlFlowNode => flow('FLOW_OP_IF', [condition], [flowBody(then, position)], position);

/** `while (true) { body }`, the one loop a lowered tree holds. */
export const loop = (statements: readonly Statement[], position: SourcePosition): ControlFlowNode =>
  flow('FLOW_OP_WHILE', [boolean(true, position)], [flowBody(statements, position)], position);

export const breakStatement = (position: SourcePosition): ControlFlowNode =>
  flow('FLOW_OP_BREAK', [], [], position);

/** `if (!condition) break;`. */
export const breakUnless = (condition: Expression): ControlFlowNode =>
  ifStatement(not(condition), [breakStatement(condition.position)], condition.position);
