/**
 * The operators the translator reads: Godot's enumerator, its token, its text in Godot's messages
 * (`get_operator_text`, `shader_language.cpp:44`) and its binding level. The parser builds its
 * levels from this table, and the emitter keys its TSL calls by the same enumerators.
 */

export const BINARY_OPERATORS = {
  OP_MUL: { token: 'TK_OP_MUL', text: '*', level: 0 },
  OP_DIV: { token: 'TK_OP_DIV', text: '/', level: 0 },
  OP_ADD: { token: 'TK_OP_ADD', text: '+', level: 1 },
  OP_SUB: { token: 'TK_OP_SUB', text: '-', level: 1 },
} as const;

export type BinaryOperator = keyof typeof BINARY_OPERATORS;

/** Every operator the emitter builds: the binary ones and negation. */
export type TranslatedOperator = BinaryOperator | 'OP_NEGATE';

const ENTRIES = Object.entries(BINARY_OPERATORS) as [
  BinaryOperator,
  (typeof BINARY_OPERATORS)[BinaryOperator],
][];

/** The binary operators by token. */
export const BINARY_BY_TOKEN: ReadonlyMap<string, BinaryOperator> = new Map(
  ENTRIES.map(([op, { token }]) => [token, op])
);

/** The binding levels, tightest first, as Godot's priority loop reduces (`shader_language.cpp:7600`). */
export const BINARY_LEVEL_COUNT = Math.max(...ENTRIES.map(([, { level }]) => level)) + 1;

/** Godot's text of an operator in a message: `-` for negation. */
export function operatorText(op: TranslatedOperator): string {
  return op === 'OP_NEGATE' ? '-' : BINARY_OPERATORS[op].text;
}

/** The enumerator of an operator row id, `OP_ADD` for `OP_ADD(vec3,float)`. */
export function operatorOfRow(rowId: string): TranslatedOperator {
  return rowId.slice(0, rowId.indexOf('(')) as TranslatedOperator;
}
