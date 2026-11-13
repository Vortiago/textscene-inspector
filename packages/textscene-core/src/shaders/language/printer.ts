/**
 * The printer: a typed tree back to shading language text that the parser reads as the same
 * tree. Each operator is written in brackets, so the text keeps the tree's shape.
 */

import { reduced } from './constants.js';
import { operatorText } from './operators.js';
import type { ConstantNode, Expression, FunctionNode, ShaderNode, Statement } from './shaderTree.js';
import { shapeOf } from './types.js';

/** The text of `shader`, one function after another. */
export function printShader(shader: ShaderNode): string {
  return shader.functions.map(printFunction).join('\n\n');
}

function printFunction(definition: FunctionNode): string {
  const args = definition.arguments.map((argument) => `${argument.type} ${argument.name}`).join(', ');
  const body = definition.body.statements.map((statement) => `\t${printStatement(statement)}\n`).join('');
  return `${definition.returnType} ${definition.name}(${args}) {\n${body}}`;
}

function printStatement(statement: Statement): string {
  if (statement.kind === 'control flow') {
    const value = statement.expressions[0];
    return value === undefined ? 'return;' : `return ${printExpression(value)};`;
  }
  if (statement.kind === 'operator' && statement.op === 'OP_EMPTY') return ';';
  return `${printExpression(statement)};`;
}

const POSTFIX_OPERATORS = new Set(['OP_POST_INCREMENT', 'OP_POST_DECREMENT']);

/**
 * The text of `expression`. A prefix operator stands without brackets, because the parser reduces
 * the text in brackets, which would fold `-vec2(1.0)` into a constant.
 */
function printExpression(expression: Expression): string {
  switch (expression.kind) {
    case 'constant':
      return printConstant(expression);
    case 'variable':
      return expression.name;
    case 'member':
      return `${printOwner(expression.owner)}.${expression.name}`;
    case 'operator': {
      const { op, operands } = expression;
      const texts = operands.map(printExpression);
      if (op === 'OP_CONSTRUCT')
        return `${expression.row.id.slice(0, expression.row.id.indexOf('('))}(${texts.join(', ')})`;
      if (op === 'OP_INDEX') return `${printOwner(operands[0]!)}[${texts[1]}]`;
      if (op === 'OP_SELECT_IF')
        return `(${texts[0]} ? ${printTernaryPart(operands[1]!)} : ${printTernaryPart(operands[2]!)})`;
      if (POSTFIX_OPERATORS.has(op)) return `${printOwner(operands[0]!)}${operatorText(op)}`;
      if (operands.length === 1) return `${operatorText(op)}(${texts[0]})`;
      return `(${texts[0]} ${operatorText(op)} ${texts[1]})`;
    }
  }
}

/** An operand a swizzle, an index or a post step follows: in brackets unless it is a name or brackets already. */
function printOwner(owner: Expression): string {
  const text = printExpression(owner);
  return owner.kind === 'variable' || text.startsWith('(') ? text : `(${text})`;
}

/**
 * A part of `?:`. The parser keeps a negation of a constant there and negates the constant in
 * place (`shader_language.cpp:7832`), so the text negates the constant back.
 */
function printTernaryPart(part: Expression): string {
  if (part.kind !== 'operator' || part.op !== 'OP_NEGATE' || part.operands[0]!.kind !== 'constant')
    return printExpression(part);
  const negated = reduced({ ...part, operands: [part.operands[0]!] });
  return `-(${printExpression(negated)})`;
}

/**
 * A constant as literals the parser folds back to it: a vector or a matrix as its constructor,
 * and a negative scalar as a negated literal in brackets, which the parser folds.
 */
function printConstant(constant: ConstantNode): string {
  const shape = shapeOf(constant.type)!;
  const lanes = constant.values.map((value) => printScalar(shape.scalar, value));
  if (shape.lanes === 1) return lanes[0]!;
  if (shape.columns === undefined) return `${constant.type}(${lanes.join(', ')})`;
  const columns = Array.from(
    { length: shape.columns },
    (_, column) =>
      `vec${shape.columns}(${lanes.slice(column * shape.columns!, (column + 1) * shape.columns!).join(', ')})`
  );
  return `${constant.type}(${columns.join(', ')})`;
}

function printScalar(scalar: string, value: number | boolean): string {
  if (scalar === 'bool') return String(value);
  if (scalar === 'uint') return `${value as number}u`;
  const number = value as number;
  const text = scalar === 'int' ? String(Math.abs(number)) : floatText(Math.abs(number));
  return number < 0 || Object.is(number, -0) ? `(-${text})` : text;
}

/** A float's text, with the digits that read back to the same 32-bit float. */
function floatText(value: number): string {
  if (!Number.isFinite(value)) throw new Error(`expected a finite float constant, got ${value}`);
  if (Number.isInteger(value) && value < 1e21) return `${value}.0`;
  const [mantissa, exponent] = value.toExponential().split('e') as [string, string];
  return `${mantissa.includes('.') ? mantissa : `${mantissa}.0`}e${exponent}`;
}
