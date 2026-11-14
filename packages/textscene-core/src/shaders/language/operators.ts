/**
 * Godot's operators as `_parse_expression` reads and reduces them: the token of each, its
 * priority in the reduction loop (`shader_language.cpp:7501`) and its text in Godot's messages
 * (`get_operator_text`, `shader_language.cpp:44`).
 */

/** The operator of a token after an operand (`shader_language.cpp:7363`). */
export const BINARY_OPERATOR_OF_TOKEN: ReadonlyMap<string, string> = new Map([
  ['TK_OP_EQUAL', 'OP_EQUAL'],
  ['TK_OP_NOT_EQUAL', 'OP_NOT_EQUAL'],
  ['TK_OP_LESS', 'OP_LESS'],
  ['TK_OP_LESS_EQUAL', 'OP_LESS_EQUAL'],
  ['TK_OP_GREATER', 'OP_GREATER'],
  ['TK_OP_GREATER_EQUAL', 'OP_GREATER_EQUAL'],
  ['TK_OP_AND', 'OP_AND'],
  ['TK_OP_OR', 'OP_OR'],
  ['TK_OP_ADD', 'OP_ADD'],
  ['TK_OP_SUB', 'OP_SUB'],
  ['TK_OP_MUL', 'OP_MUL'],
  ['TK_OP_DIV', 'OP_DIV'],
  ['TK_OP_MOD', 'OP_MOD'],
  ['TK_OP_SHIFT_LEFT', 'OP_SHIFT_LEFT'],
  ['TK_OP_SHIFT_RIGHT', 'OP_SHIFT_RIGHT'],
  ['TK_OP_ASSIGN', 'OP_ASSIGN'],
  ['TK_OP_ASSIGN_ADD', 'OP_ASSIGN_ADD'],
  ['TK_OP_ASSIGN_SUB', 'OP_ASSIGN_SUB'],
  ['TK_OP_ASSIGN_MUL', 'OP_ASSIGN_MUL'],
  ['TK_OP_ASSIGN_DIV', 'OP_ASSIGN_DIV'],
  ['TK_OP_ASSIGN_MOD', 'OP_ASSIGN_MOD'],
  ['TK_OP_ASSIGN_SHIFT_LEFT', 'OP_ASSIGN_SHIFT_LEFT'],
  ['TK_OP_ASSIGN_SHIFT_RIGHT', 'OP_ASSIGN_SHIFT_RIGHT'],
  ['TK_OP_ASSIGN_BIT_AND', 'OP_ASSIGN_BIT_AND'],
  ['TK_OP_ASSIGN_BIT_OR', 'OP_ASSIGN_BIT_OR'],
  ['TK_OP_ASSIGN_BIT_XOR', 'OP_ASSIGN_BIT_XOR'],
  ['TK_OP_BIT_AND', 'OP_BIT_AND'],
  ['TK_OP_BIT_OR', 'OP_BIT_OR'],
  ['TK_OP_BIT_XOR', 'OP_BIT_XOR'],
  ['TK_QUESTION', 'OP_SELECT_IF'],
  ['TK_COLON', 'OP_SELECT_ELSE'],
]);

/** The operator of a token before an operand (`shader_language.cpp:6738`). A unary `+` is skipped. */
export const UNARY_OPERATOR_OF_TOKEN: ReadonlyMap<string, string> = new Map([
  ['TK_OP_SUB', 'OP_NEGATE'],
  ['TK_OP_NOT', 'OP_NOT'],
  ['TK_OP_BIT_INVERT', 'OP_BIT_INVERT'],
  ['TK_OP_INCREMENT', 'OP_INCREMENT'],
  ['TK_OP_DECREMENT', 'OP_DECREMENT'],
]);

/** `is_token_operator` (`shader_language.cpp:4127`): the tokens that end an operand as an operator. */
export const OPERATOR_TOKENS: ReadonlySet<string> = new Set([
  ...BINARY_OPERATOR_OF_TOKEN.keys(),
  ...UNARY_OPERATOR_OF_TOKEN.keys(),
]);

export type OperatorArity = 'unary' | 'binary' | 'ternary';

interface OperatorRule {
  /** The reduction applies the lowest priority first, leftmost first. */
  readonly priority: number;
  readonly arity: OperatorArity;
}

const rule = (priority: number, arity: OperatorArity = 'binary'): OperatorRule => ({ priority, arity });

const ASSIGN_OPERATORS = [
  'OP_ASSIGN',
  'OP_ASSIGN_ADD',
  'OP_ASSIGN_SUB',
  'OP_ASSIGN_MUL',
  'OP_ASSIGN_DIV',
  'OP_ASSIGN_MOD',
  'OP_ASSIGN_SHIFT_LEFT',
  'OP_ASSIGN_SHIFT_RIGHT',
  'OP_ASSIGN_BIT_AND',
  'OP_ASSIGN_BIT_OR',
  'OP_ASSIGN_BIT_XOR',
];

/** The priority and arity of each operator the reduction loop reads (`shader_language.cpp:7513`). */
export const OPERATOR_RULES: ReadonlyMap<string, OperatorRule> = new Map([
  ['OP_NOT', rule(3, 'unary')],
  ['OP_NEGATE', rule(3, 'unary')],
  ['OP_BIT_INVERT', rule(3, 'unary')],
  ['OP_INCREMENT', rule(3, 'unary')],
  ['OP_DECREMENT', rule(3, 'unary')],
  ['OP_MUL', rule(4)],
  ['OP_DIV', rule(4)],
  ['OP_MOD', rule(4)],
  ['OP_ADD', rule(5)],
  ['OP_SUB', rule(5)],
  ['OP_SHIFT_LEFT', rule(6)],
  ['OP_SHIFT_RIGHT', rule(6)],
  ['OP_LESS', rule(7)],
  ['OP_LESS_EQUAL', rule(7)],
  ['OP_GREATER', rule(7)],
  ['OP_GREATER_EQUAL', rule(7)],
  ['OP_EQUAL', rule(8)],
  ['OP_NOT_EQUAL', rule(8)],
  ['OP_BIT_AND', rule(9)],
  ['OP_BIT_XOR', rule(10)],
  ['OP_BIT_OR', rule(11)],
  ['OP_AND', rule(12)],
  ['OP_OR', rule(14)],
  ['OP_SELECT_IF', rule(15, 'ternary')],
  ['OP_SELECT_ELSE', rule(15, 'ternary')],
  ...ASSIGN_OPERATORS.map((op): [string, OperatorRule] => [op, rule(16)]),
]);

/** `_is_operator_assign` (`shader_language.cpp:5386`). */
export const isAssignOperator = (op: string): boolean => ASSIGN_OPERATORS.includes(op);

/** Godot's text of each operator in a message, `-` for `OP_NEGATE` and `++` for both increments. */
const OPERATOR_TEXT: Readonly<Record<string, string>> = {
  OP_EQUAL: '==',
  OP_NOT_EQUAL: '!=',
  OP_LESS: '<',
  OP_LESS_EQUAL: '<=',
  OP_GREATER: '>',
  OP_GREATER_EQUAL: '>=',
  OP_AND: '&&',
  OP_OR: '||',
  OP_NOT: '!',
  OP_NEGATE: '-',
  OP_ADD: '+',
  OP_SUB: '-',
  OP_MUL: '*',
  OP_DIV: '/',
  OP_MOD: '%',
  OP_SHIFT_LEFT: '<<',
  OP_SHIFT_RIGHT: '>>',
  OP_ASSIGN: '=',
  OP_ASSIGN_ADD: '+=',
  OP_ASSIGN_SUB: '-=',
  OP_ASSIGN_MUL: '*=',
  OP_ASSIGN_DIV: '/=',
  OP_ASSIGN_MOD: '%=',
  OP_ASSIGN_SHIFT_LEFT: '<<=',
  OP_ASSIGN_SHIFT_RIGHT: '>>=',
  OP_ASSIGN_BIT_AND: '&=',
  OP_ASSIGN_BIT_OR: '|=',
  OP_ASSIGN_BIT_XOR: '^=',
  OP_BIT_AND: '&',
  OP_BIT_OR: '|',
  OP_BIT_XOR: '^',
  OP_BIT_INVERT: '~',
  OP_INCREMENT: '++',
  OP_DECREMENT: '--',
  OP_SELECT_IF: '?',
  OP_SELECT_ELSE: ':',
  OP_POST_INCREMENT: '++',
  OP_POST_DECREMENT: '--',
};

export const operatorText = (op: string): string => OPERATOR_TEXT[op]!;
