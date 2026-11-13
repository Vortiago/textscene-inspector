/**
 * The rows the emitter emits so far. `checkTranspiled` refuses each other row a tree holds, at
 * its place in the text, naming the issue that owns the row.
 */

import { instruction, keywordInstruction, notTranspiled } from './instructions.js';
import type { InstructionRow } from './instructionTable.generated.js';
import type { SourcePosition } from './shadingLanguageError.js';
import type { Expression, FunctionNode, ShaderNode, Statement } from './shaderTree.js';
import { shapeOf } from './types.js';

/** The issues whose rows the emitter emits: each row the table gives one of them. */
const TRANSPILED_OWNERS: ReadonlySet<string> = new Set(['#1823']);

const isTranspiled = (row: InstructionRow) => TRANSPILED_OWNERS.has(row.owner);

export function checkTranspiled(shader: ShaderNode): void {
  for (const definition of shader.functions) checkFunction(definition);
}

function checkFunction(definition: FunctionNode): void {
  checkType(definition.returnType, definition.position);
  for (const argument of definition.arguments) checkType(argument.type, argument.position);
  for (const statement of definition.body.statements) checkStatement(statement);
}

function checkStatement(statement: Statement): void {
  if (statement.kind === 'control flow') statement.expressions.forEach(checkExpression);
  else if (statement.kind !== 'operator' || statement.op !== 'OP_EMPTY') checkExpression(statement);
}

function checkExpression(expression: Expression): void {
  switch (expression.kind) {
    case 'constant':
      checkRow(literalRow(expression.type), expression.position);
      return;
    case 'variable':
      return;
    case 'member':
      checkRow(expression.row, expression.position);
      return checkExpression(expression.owner);
    case 'operator':
      expression.operands.forEach(checkExpression);
      checkRow(expression.row, expression.position);
  }
}

function checkType(type: string, position: SourcePosition): void {
  checkRow(instruction(type)!, position);
}

function checkRow(row: InstructionRow, position: SourcePosition): void {
  if (!isTranspiled(row)) throw notTranspiled(row, position);
}

/** The literal row of a constant's scalar kind: `int literal`, or `true` for a bool. */
function literalRow(type: string): InstructionRow {
  const scalar = shapeOf(type)!.scalar;
  return scalar === 'bool' ? keywordInstruction('TK_TRUE')! : instruction(`${scalar} literal`)!;
}
