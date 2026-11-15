/** `Expression::_execute` (expression.cpp:1239) with no inputs and no base instance, as the shader preprocessor runs it. */

import { withEntry } from '../variant/compare.js';
import { construct } from '../variant/construct/construct.js';
import { evaluateOperator } from '../variant/operators/evaluate.js';
import {
  NIL,
  variant,
  type DictionaryEntry,
  type Variant,
  type VariantTypeName,
} from '../variant/value/variant.js';
import { VARIANT_TYPE, variantTypeName } from '../variant/variantType.js';
import { parseExpression, type ExpressionNode, type Operator } from './parser.js';

/** An expression node whose Godot behaviour this port does not have yet. */
export class UnportedExpression extends Error {}

class ExecuteError extends Error {}

export type ExpressionResult =
  { readonly value: Variant } | { readonly parseError: string } | { readonly executeError: string };

// Variant::get_operator_name (variant_op.cpp:1081).
const OPERATOR_NAME: Readonly<Record<Operator, string>> = {
  OP_EQUAL: '==',
  OP_NOT_EQUAL: '!=',
  OP_LESS: '<',
  OP_LESS_EQUAL: '<=',
  OP_GREATER: '>',
  OP_GREATER_EQUAL: '>=',
  OP_ADD: '+',
  OP_SUBTRACT: '-',
  OP_MULTIPLY: '*',
  OP_DIVIDE: '/',
  OP_NEGATE: 'unary-',
  OP_POSITIVE: 'unary+',
  OP_MODULE: '%',
  OP_POWER: '**',
  OP_SHIFT_LEFT: '<<',
  OP_SHIFT_RIGHT: '>>',
  OP_BIT_AND: '&',
  OP_BIT_OR: '|',
  OP_BIT_XOR: '^',
  OP_BIT_NEGATE: '~',
  OP_AND: 'and',
  OP_OR: 'or',
  OP_XOR: 'xor',
  OP_NOT: 'not',
  OP_IN: 'in',
};

const typeName = (type: VariantTypeName) => variantTypeName(VARIANT_TYPE[type])!;

function evaluate(node: Extract<ExpressionNode, { kind: 'operator' }>): Variant {
  const a = execute(node.left);
  const b = node.right ? execute(node.right) : NIL;
  const result = evaluateOperator(node.operator, a, b);
  if (result) return result;
  throw new ExecuteError(
    `Invalid operands to operator ${OPERATOR_NAME[node.operator]}, ${typeName(a.type)} and ${typeName(b.type)}.`
  );
}

function dictionaryOf(nodes: readonly ExpressionNode[]): Variant {
  let entries: readonly DictionaryEntry[] = [];
  for (let index = 0; index < nodes.length; index += 2) {
    const key = execute(nodes[index]!);
    entries = withEntry(entries, key, execute(nodes[index + 1]!));
  }
  return variant('DICTIONARY', entries);
}

function constructed(node: Extract<ExpressionNode, { kind: 'constructor' }>): Variant {
  const value = construct(node.type, node.arguments.map(execute));
  if (value) return value;
  throw new ExecuteError(`Invalid arguments to construct '${typeName(node.type)}'`);
}

function execute(node: ExpressionNode): Variant {
  switch (node.kind) {
    case 'input':
      throw new ExecuteError(`Invalid input ${node.index} (not passed) in expression`);
    case 'constant':
      return node.value;
    case 'self':
      throw new ExecuteError("self can't be used because instance is null (not passed)");
    case 'operator':
      return evaluate(node);
    case 'array':
      return variant('ARRAY', node.elements.map(execute));
    case 'dictionary':
      return dictionaryOf(node.entries);
    case 'constructor':
      return constructed(node);
    case 'index':
      execute(node.base);
      execute(node.index);
      throw new UnportedExpression('Variant::get of an index');
    case 'namedIndex':
      execute(node.base);
      throw new UnportedExpression(`Variant::get_named of '${node.name}'`);
    case 'builtinFunction':
      node.arguments.forEach(execute);
      throw new UnportedExpression(`the utility function ${node.name}`);
    case 'call':
      execute(node.base);
      node.arguments.forEach(execute);
      throw new UnportedExpression(`the method ${node.method}`);
  }
}

/**
 * The text parsed and executed as Godot's Expression class does it. A text that crashes Godot throws
 * GodotCrash, and a node this port does not have yet throws UnportedExpression.
 */
export function runExpression(text: string): ExpressionResult {
  const parsed = parseExpression(text);
  if ('error' in parsed) return { parseError: parsed.error };
  try {
    return { value: execute(parsed.root) };
  } catch (error) {
    if (error instanceof ExecuteError) return { executeError: error.message };
    throw error;
  }
}
