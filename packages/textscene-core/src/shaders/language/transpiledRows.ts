import { instruction, keywordInstruction, notTranspiled } from './instructions.js';
import type { InstructionRow } from './instructionTable.generated.js';
import type { SourcePosition } from './shadingLanguageError.js';
import type { Expression, FunctionNode, ShaderNode, Statement, UniformNode } from './shaderTree.js';
import { everyExpression, everyStatement, statementExpressions } from './treeWalk.js';
import { shapeOf } from './types.js';

/** A row the emitter emits has a state on each target, which a probe against Godot backs. */
const isTranspiled = (row: InstructionRow) => row.webgl2 !== undefined;

export function checkTranspiled(shader: ShaderNode): void {
  if (shader.shaderType && shader.headPosition)
    checkRow(instruction(`shader_type ${shader.shaderType}`)!, shader.headPosition);
  for (const struct of shader.structs) {
    checkRow(instruction('NODE_TYPE_STRUCT')!, struct.position);
    for (const member of struct.members) checkType(member.type, struct.position);
  }
  for (const { position } of shader.uniformGroups) checkRow(instruction('group_uniforms')!, position);
  for (const uniform of shader.uniforms) checkUniform(uniform);
  for (const definition of shader.functions) checkFunction(definition);
}

function checkUniform(uniform: UniformNode): void {
  for (const row of uniform.rows) checkRow(row, uniform.position);
  checkType(uniform.type, uniform.position);
  if (uniform.arraySize) checkRow(instruction('NODE_TYPE_ARRAY')!, uniform.position);
  if (uniform.defaultValue) checkRow(literalRow(uniform.type), uniform.position);
}

function checkFunction(definition: FunctionNode): void {
  checkType(definition.returnType, definition.position);
  if (definition.returnArraySize) checkRow(instruction('NODE_TYPE_ARRAY')!, definition.position);
  for (const argument of definition.arguments) {
    checkType(argument.type, argument.position);
    checkRow(instruction(argument.qualifier)!, argument.position);
    if (argument.arraySize) checkRow(instruction('NODE_TYPE_ARRAY')!, argument.position);
  }
  for (const statement of everyStatement(definition.body)) {
    checkStatement(statement);
    for (const expression of statementExpressions(statement))
      for (const part of everyExpression(expression)) checkExpression(part);
  }
}

function checkStatement(statement: Statement): void {
  switch (statement.kind) {
    case 'block':
      return checkRow(instruction('NODE_TYPE_BLOCK')!, statement.position);
    case 'declaration':
      checkRow(instruction('NODE_TYPE_VARIABLE_DECLARATION')!, statement.position);
      return checkType(statement.type, statement.position);
    case 'control flow':
      checkRow(instruction('NODE_TYPE_CONTROL_FLOW')!, statement.position);
      return checkRow(instruction(statement.flow)!, statement.position);
  }
}

function checkExpression(expression: Expression): void {
  switch (expression.kind) {
    case 'constant':
      return checkRow(literalRow(expression.type), expression.position);
    case 'variable':
      if (expression.builtIn) checkRow(instruction(expression.builtIn)!, expression.position);
      if ((expression.arraySize ?? 0) > 0) checkRow(instruction('NODE_TYPE_ARRAY')!, expression.position);
      return;
    case 'member':
    case 'operator':
      return checkRow(expression.row, expression.position);
    case 'array element':
      return checkRow(instruction('NODE_TYPE_ARRAY')!, expression.position);
    case 'array construct':
      return checkRow(instruction('NODE_TYPE_ARRAY_CONSTRUCT')!, expression.position);
    case 'array length':
      return checkRow(instruction('length[array]()')!, expression.position);
    case 'field':
      return checkRow(instruction('NODE_TYPE_MEMBER')!, expression.position);
    case 'whole assign':
      return checkRow(
        instruction(expression.arraySize ? 'NODE_TYPE_ARRAY' : 'NODE_TYPE_STRUCT')!,
        expression.position
      );
  }
}

/** A type's own row, `sampler2D` or `vec3`, or the struct row for the name of a struct. */
function checkType(type: string, position: SourcePosition): void {
  const row = instruction(type);
  checkRow(row?.family === 'data type' ? row : instruction('struct type')!, position);
}

function checkRow(row: InstructionRow, position: SourcePosition): void {
  if (!isTranspiled(row)) throw notTranspiled(row, position);
}

/** The literal row of a constant's scalar kind: `int literal`, or `true` for a bool. */
function literalRow(type: string): InstructionRow {
  const scalar = shapeOf(type)!.scalar;
  return scalar === 'bool' ? keywordInstruction('TK_TRUE')! : instruction(`${scalar} literal`)!;
}
