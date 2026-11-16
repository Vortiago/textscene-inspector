import { callMethod } from '../variant/call/callMethod.js';
import { setEntry } from '../variant/compare.js';
import { construct, failedConstruction } from '../variant/construct/construct.js';
import { evaluateOperator } from '../variant/operators/evaluate.js';
import { getNamed, variantGet } from '../variant/setget/variantGet.js';
import { callErrorText } from '../variant/utility/callError.js';
import { callUtility } from '../variant/utility/callUtility.js';
import { utilityHost, type UtilityHost } from '../variant/utility/utilityHost.js';
import { NIL, variant, type DictionaryEntry, type Variant } from '../variant/value/variant.js';
import { variantTypeNameOf } from '../variant/variantType.js';
import { parseExpression, type ExpressionNode, type Operator } from './parser.js';
import { NotPortable } from '../notPortable.js';

/** An expression node whose Godot behaviour this port does not have yet. */
export class UnportedExpression extends NotPortable {}

// `value` is the `r_ret` the failed node leaves, which `execute` returns when that node is the root.
class ExecuteError extends Error {
  constructor(
    message: string,
    readonly node: ExpressionNode,
    readonly value: Variant = NIL
  ) {
    super(message);
  }
}

/** A failed execution still has a value: Nil, or the text an operator left, such as a division by zero. */
export type ExpressionResult =
  | { readonly value: Variant }
  | { readonly parseError: string }
  | { readonly executeError: string; readonly value: Variant };

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

/** One run of `Expression::execute`, with the global random generator its utility calls draw from. */
class Execution {
  constructor(private readonly host: UtilityHost) {}

  execute = (node: ExpressionNode): Variant => {
    switch (node.kind) {
      case 'input':
        throw new ExecuteError(`Invalid input ${node.index} (not passed) in expression`, node);
      case 'constant':
        return node.value;
      case 'self':
        throw new ExecuteError("self can't be used because instance is null (not passed)", node);
      case 'operator':
        return this.evaluate(node);
      case 'array':
        return variant('ARRAY', node.elements.map(this.execute));
      case 'dictionary':
        return this.dictionaryOf(node.entries);
      case 'constructor':
        return this.constructed(node);
      case 'index':
        return this.indexed(node);
      case 'namedIndex':
        return this.named(node);
      case 'builtinFunction':
        return this.called(node);
      case 'call':
        return this.calledMethod(node);
    }
  };

  private evaluate(node: Extract<ExpressionNode, { kind: 'operator' }>): Variant {
    const a = this.execute(node.left);
    const b = node.right ? this.execute(node.right) : NIL;
    const { value, isValid } = evaluateOperator(node.operator, a, b);
    if (isValid) return value;
    const operands = `${variantTypeNameOf(a.type)} and ${variantTypeNameOf(b.type)}`;
    throw new ExecuteError(
      `Invalid operands to operator ${OPERATOR_NAME[node.operator]}, ${operands}.`,
      node,
      value
    );
  }

  private indexed(node: Extract<ExpressionNode, { kind: 'index' }>): Variant {
    const base = this.execute(node.base);
    const index = this.execute(node.index);
    const { value, isValid } = variantGet(base, index);
    if (isValid) return value;
    const types = `${variantTypeNameOf(index.type)} for base type ${variantTypeNameOf(base.type)}`;
    throw new ExecuteError(`Invalid index of type ${types}`, node, value);
  }

  private named(node: Extract<ExpressionNode, { kind: 'namedIndex' }>): Variant {
    const base = this.execute(node.base);
    const { value, isValid } = getNamed(base, node.name);
    if (isValid) return value;
    const message = `Invalid named index '${node.name}' for base type ${variantTypeNameOf(base.type)}`;
    throw new ExecuteError(message, node, value);
  }

  private dictionaryOf(nodes: readonly ExpressionNode[]): Variant {
    const entries: DictionaryEntry[] = [];
    for (let index = 0; index < nodes.length; index += 2) {
      const key = this.execute(nodes[index]!);
      setEntry(entries, key, this.execute(nodes[index + 1]!));
    }
    return variant('DICTIONARY', entries);
  }

  private constructed(node: Extract<ExpressionNode, { kind: 'constructor' }>): Variant {
    const args = node.arguments.map(this.execute);
    const value = construct(node.type, args);
    if (value) return value;
    const message = `Invalid arguments to construct '${variantTypeNameOf(node.type)}'`;
    throw new ExecuteError(message, node, failedConstruction(node.type, args));
  }

  // expression.cpp:1424: every call error has the one text, and a refused argument still leaves a value.
  private calledMethod(node: Extract<ExpressionNode, { kind: 'call' }>): Variant {
    const base = this.execute(node.base);
    const args = node.arguments.map(this.execute);
    const result = callMethod(base, node.method, args, this.host);
    if (!result) throw new UnportedExpression(`the method ${node.method}`);
    if (result.isValid) return result.value;
    throw new ExecuteError(`On call to '${node.method}':`, node, result.value);
  }

  // expression.cpp:1397: a failed call still leaves the value it returned.
  private called(node: Extract<ExpressionNode, { kind: 'builtinFunction' }>): Variant {
    const args = node.arguments.map(this.execute);
    const result = callUtility(node.name, args, this.host);
    if (!result) throw new UnportedExpression(`the utility function ${node.name}`);
    if (!result.error) return result.value;
    const message = `Builtin call failed: ${callErrorText(node.name, args, result.error)}`;
    throw new ExecuteError(message, node, result.value);
  }
}

/** Throws where the port stops: GodotCrash, UnportedExpression, UnportableUtility and the rest. */
export function runExpression(text: string, host = utilityHost()): ExpressionResult {
  const parsed = parseExpression(text);
  if ('error' in parsed) return { parseError: parsed.error };
  try {
    return { value: new Execution(host).execute(parsed.root) };
  } catch (error) {
    if (error instanceof ExecuteError)
      return { executeError: error.message, value: error.node === parsed.root ? error.value : NIL };
    throw error;
  }
}
