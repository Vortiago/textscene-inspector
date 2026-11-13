/**
 * The rows the emitter emits so far. `checkTranspiled` refuses each other row a tree holds, at
 * its place in the text, naming the issue that owns the row.
 */

import { instruction, keywordInstruction, notTranspiled } from './instructions.js';
import type { InstructionRow } from './instructionTable.generated.js';
import type { SourcePosition } from './shadingLanguageError.js';
import type { Expression, FunctionNode, ShaderNode, Statement } from './shaderTree.js';
import { shapeOf } from './types.js';

const TRANSPILED_TYPES: ReadonlySet<string> = new Set(['float', 'vec2', 'vec3', 'vec4']);

const TRANSPILED_OPERATORS: ReadonlySet<string> = new Set([
  'OP_ADD',
  'OP_SUB',
  'OP_MUL',
  'OP_DIV',
  'OP_NEGATE',
  'OP_CONSTRUCT',
]);

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
      if (!TRANSPILED_TYPES.has(expression.type))
        throw notTranspiled(literalRow(expression.type), expression.position);
      return;
    case 'variable':
      return;
    case 'member':
      if (!TRANSPILED_TYPES.has(expression.owner.type))
        throw notTranspiled(expression.row, expression.position);
      return checkExpression(expression.owner);
    case 'operator':
      expression.operands.forEach(checkExpression);
      if (
        !TRANSPILED_OPERATORS.has(expression.op) ||
        !rowTypes(expression.row).every((type) => TRANSPILED_TYPES.has(type))
      ) {
        throw notTranspiled(expression.row, expression.position);
      }
  }
}

/** The types a row returns and takes. A generic row, `OP_INDEX`, has none, so it is refused. */
function rowTypes(row: InstructionRow): string[] {
  if (row.returns === undefined) return ['generic'];
  return [row.returns, ...(row.args ?? [])];
}

function checkType(type: string, position: SourcePosition): void {
  if (!TRANSPILED_TYPES.has(type)) throw notTranspiled(instruction(type)!, position);
}

/** The literal row of a constant's scalar kind: `int literal`, or `true` for a bool. */
function literalRow(type: string): InstructionRow {
  const scalar = shapeOf(type)!.scalar;
  return scalar === 'bool' ? keywordInstruction('TK_TRUE')! : instruction(`${scalar} literal`)!;
}
