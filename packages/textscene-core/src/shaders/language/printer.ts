/**
 * The printer: a typed tree back to shading language text that the parser reads as the same
 * tree. Each operator is written in brackets, so the text keeps the tree's shape.
 */

import { reduced } from './constants.js';
import { operatorText } from './operators.js';
import type {
  BlockNode,
  ConstantNode,
  ControlFlowNode,
  DeclarationNode,
  Expression,
  FunctionNode,
  ShaderNode,
  Statement,
  StructNode,
} from './shaderTree.js';
import { shapeOf } from './types.js';
import { isEmpty } from './treeWalk.js';

/** The text of `shader`: its structs, then its functions, in order. */
export function printShader(shader: ShaderNode): string {
  return [...shader.structs.map(printStruct), ...shader.functions.map(printFunction)].join('\n\n');
}

function printStruct(struct: StructNode): string {
  const members = struct.members.map(
    (member) =>
      `\t${member.type} ${member.name}${member.arraySize !== undefined ? `[${member.arraySize}]` : ''};\n`
  );
  return `struct ${struct.name} {\n${members.join('')}};`;
}

function printFunction(definition: FunctionNode): string {
  const args = definition.arguments.map((argument) => `${argument.type} ${argument.name}`).join(', ');
  return `${definition.returnType} ${definition.name}(${args}) ${printBlock(definition.body, '')}`;
}

/** A block in braces, each statement on its own line one tab in from `indent`. */
function printBlock(block: BlockNode, indent: string): string {
  const inner = `${indent}\t`;
  const lines = block.statements.map((statement) => `${inner}${printStatement(statement, inner)}\n`);
  return `{\n${lines.join('')}${indent}}`;
}

/**
 * The one statement of a block Godot reads as one statement, the body of `if`, a loop or an
 * initialiser. Written without braces, it parses back to the same block.
 */
function printOnlyStatement(block: BlockNode, indent: string): string {
  const [statement] = block.statements;
  if (block.statements.length !== 1 || statement === undefined)
    throw new Error(`expected a block of one statement, got ${block.statements.length}`);
  return printStatement(statement, indent);
}

function printStatement(statement: Statement, indent: string): string {
  switch (statement.kind) {
    case 'block':
      return printBlock(statement, indent);
    case 'declaration':
      return printDeclaration(statement);
    case 'control flow':
      return printFlow(statement, indent);
    default:
      return isEmpty(statement) ? ';' : `${printExpression(statement)};`;
  }
}

/** A declaration, an array's value as a list in `{}`, which reads back for an array of structs too. */
function printDeclaration(declaration: DeclarationNode): string {
  const names = declaration.declarators.map((declarator) => {
    const size = declarator.arraySize !== undefined ? `[${declarator.arraySize}]` : '';
    const value = declarator.value;
    if (value === undefined) return `${declarator.name}${size}`;
    const text =
      value.kind === 'array construct'
        ? `{${value.elements.map(printExpression).join(', ')}}`
        : printExpression(value);
    return `${declarator.name}${size} = ${text}`;
  });
  return `${declaration.isConst ? 'const ' : ''}${declaration.type} ${names.join(', ')};`;
}

function printFlow(flow: ControlFlowNode, indent: string): string {
  const [first] = flow.expressions;
  const [block, second] = flow.blocks;
  switch (flow.flow) {
    case 'FLOW_OP_RETURN':
      return first === undefined ? 'return;' : `return ${printExpression(first)};`;
    case 'FLOW_OP_BREAK':
      return 'break;';
    case 'FLOW_OP_CONTINUE':
      return 'continue;';
    case 'FLOW_OP_DISCARD':
      return 'discard;';
    case 'FLOW_OP_IF': {
      const then = `if (${printExpression(first!)}) ${printOnlyStatement(block!, indent)}`;
      return second === undefined ? then : `${then}\n${indent}else ${printOnlyStatement(second, indent)}`;
    }
    case 'FLOW_OP_WHILE':
      return `while (${printExpression(first!)}) ${printOnlyStatement(block!, indent)}`;
    case 'FLOW_OP_DO':
      return `do ${printOnlyStatement(block!, indent)} while (${printExpression(first!)});`;
    case 'FLOW_OP_FOR':
      return printFor(flow, indent);
    case 'FLOW_OP_SWITCH':
      return `switch (${printExpression(first!)}) {\n${block!.statements.map((label) => printLabel(label as ControlFlowNode, `${indent}\t`)).join('')}${indent}}`;
    case 'FLOW_OP_CASE':
    case 'FLOW_OP_DEFAULT':
      return printLabel(flow, indent);
  }
}

/** `for (init; conditions; steps) body`, where an empty part holds Godot's empty expression. */
function printFor(flow: ControlFlowNode, indent: string): string {
  const [init, conditions, steps, body] = flow.blocks as [BlockNode, BlockNode, BlockNode, BlockNode];
  const parts = (block: BlockNode) =>
    block.statements
      .filter((part) => !isEmpty(part))
      .map((part) => printExpression(part as Expression))
      .join(', ');
  return `for (${printOnlyStatement(init, indent)} ${parts(conditions)}; ${parts(steps)}) ${printOnlyStatement(body, indent)}`;
}

/** `case n:` or `default:`, then the label's statements one tab further in. */
function printLabel(label: ControlFlowNode, indent: string): string {
  const head =
    label.flow === 'FLOW_OP_CASE'
      ? `case ${printCaseLabel(label.expressions[0] as ConstantNode)}:`
      : 'default:';
  const inner = `${indent}\t`;
  const body = label.blocks[0]!.statements.map(
    (statement) => `${inner}${printStatement(statement, inner)}\n`
  );
  return `${indent}${head}\n${body.join('')}`;
}

/** A label's integer, a negative one as `-n`, which Godot reads as a sign and a literal. */
function printCaseLabel(label: ConstantNode): string {
  const value = label.values[0] as number;
  return label.type === 'uint' ? `${value}u` : String(value);
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
    case 'field':
      return `${printOwner(expression.owner)}.${expression.name}`;
    case 'array element':
      return `${printOwner(expression.array)}[${printExpression(expression.index)}]`;
    case 'array construct':
      return `${expression.type}[${expression.arraySize}](${expression.elements.map(printExpression).join(', ')})`;
    case 'array length':
      return `${printOwner(expression.array)}.length()`;
    case 'whole assign':
      return `${printExpression(expression.target)} = ${printExpression(expression.value)}`;
    case 'operator': {
      const { op, operands } = expression;
      const texts = operands.map(printExpression);
      if (op === 'OP_CONSTRUCT')
        return `${expression.row.id.slice(0, expression.row.id.indexOf('('))}(${texts.join(', ')})`;
      if (op === 'OP_STRUCT') return `${expression.type}(${texts.join(', ')})`;
      if (op === 'OP_INDEX') return `${printOwner(operands[0]!)}[${texts[1]}]`;
      if (op === 'OP_SELECT_IF')
        return `(${texts[0]} ? ${printTernaryPart(operands[1]!)} : ${printTernaryPart(operands[2]!)})`;
      if (POSTFIX_OPERATORS.has(op)) return `${printOwner(operands[0]!)}${operatorText(op)}`;
      if (operands.length === 1) return `${operatorText(op)}(${texts[0]})`;
      return `(${texts[0]} ${operatorText(op)} ${texts[1]})`;
    }
  }
}

/**
 * An operand a swizzle, an index or a post step follows: in brackets unless it is a name, a
 * field or an array element, or brackets already. Godot reads no array or struct in brackets.
 */
function printOwner(owner: Expression): string {
  const text = printExpression(owner);
  return BARE_OWNERS.has(owner.kind) || text.startsWith('(') ? text : `(${text})`;
}

const BARE_OWNERS: ReadonlySet<string> = new Set(['variable', 'field', 'array element']);

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
