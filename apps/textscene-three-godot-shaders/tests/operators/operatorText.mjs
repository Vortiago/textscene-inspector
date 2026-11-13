/**
 * The shading language text of each of Godot's typed operators, as `get_operator_text` names
 * them (`shader_language.cpp:44`), the place of its operands and its binding priority. The
 * operator cases and the random programs both write operators through it.
 */

const PREFIX = { OP_NOT: '!', OP_NEGATE: '-', OP_BIT_INVERT: '~', OP_INCREMENT: '++', OP_DECREMENT: '--' };

const POSTFIX = { OP_POST_INCREMENT: '++', OP_POST_DECREMENT: '--' };

const INFIX = {
  OP_EQUAL: '==',
  OP_NOT_EQUAL: '!=',
  OP_LESS: '<',
  OP_LESS_EQUAL: '<=',
  OP_GREATER: '>',
  OP_GREATER_EQUAL: '>=',
  OP_AND: '&&',
  OP_OR: '||',
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
};

/** The operators that write their first operand, which must be a variable. */
export const WRITES_OPERAND = new Set([
  ...Object.keys(INFIX).filter((op) => op.startsWith('OP_ASSIGN')),
  'OP_INCREMENT',
  'OP_DECREMENT',
  ...Object.keys(POSTFIX),
]);

/** The text of `op` over the operand texts `operands`, with no brackets around it. */
export function operatorExpression(op, operands) {
  if (op in PREFIX) return `${PREFIX[op]}${operands[0]}`;
  if (op in POSTFIX) return `${operands[0]}${POSTFIX[op]}`;
  if (op in INFIX) return `${operands[0]} ${INFIX[op]} ${operands[1]}`;
  if (op === 'OP_SELECT_IF') return `${operands[0]} ? ${operands[1]} : ${operands[2]}`;
  throw new Error(`expected an operator with operands, got ${op}`);
}

/**
 * The priority of each operator in Godot's reduction loop (`shader_language.cpp:7500-7632`):
 * the lowest binds first, and operators of one priority bind left to right. A postfix operator
 * binds before the loop, as a member or an index does.
 */
const PRIORITY = {
  OP_NOT: 3,
  OP_NEGATE: 3,
  OP_BIT_INVERT: 3,
  OP_INCREMENT: 3,
  OP_DECREMENT: 3,
  OP_MUL: 4,
  OP_DIV: 4,
  OP_MOD: 4,
  OP_ADD: 5,
  OP_SUB: 5,
  OP_SHIFT_LEFT: 6,
  OP_SHIFT_RIGHT: 6,
  OP_LESS: 7,
  OP_LESS_EQUAL: 7,
  OP_GREATER: 7,
  OP_GREATER_EQUAL: 7,
  OP_EQUAL: 8,
  OP_NOT_EQUAL: 8,
  OP_BIT_AND: 9,
  OP_BIT_XOR: 10,
  OP_BIT_OR: 11,
  OP_AND: 12,
  OP_OR: 14,
  OP_SELECT_IF: 15,
};

/** The priority of `op`, or the loosest for an assignment, which always takes brackets here. */
export function operatorPriority(op) {
  if (op in POSTFIX) return 0;
  return PRIORITY[op] ?? 16;
}

/** True for an operator written before its one operand. */
export const isPrefix = (op) => op in PREFIX;

/** True for an operator of two operands written between them. */
export const isInfix = (op) => op in INFIX;
