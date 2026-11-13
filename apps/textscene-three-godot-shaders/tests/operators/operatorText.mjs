/**
 * The shading language text of each of Godot's typed operators, as `get_operator_text` names
 * them (`shader_language.cpp:44`), and the place of its operands. The operator cases and the
 * random programs both write operators through it, so a test of any operator needs no list.
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
