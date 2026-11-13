/**
 * The cases of the operator rules: every operator of the instruction table over every tuple of the
 * value types its rows use. Each case is a one-line shader, so Godot and the transpiler both
 * report an error on line 1.
 */

import { INSTRUCTION_TABLE } from '../../../../packages/textscene-core/src/shaders/language/instructionTable.generated.ts';
import { operatorExpression } from './operatorText.mjs';

const TYPED_OPERATOR_ROWS = INSTRUCTION_TABLE.filter((row) => row.family === 'operator' && row.args?.length);

/** The operand types of the operator rows, in the table's order: `bool` to `mat4`. */
const VALUE_TYPES = [...new Set(TYPED_OPERATOR_ROWS.flatMap((row) => row.args))];

/** The operand count of each operator that has typed rows. */
const ARITY = new Map(
  TYPED_OPERATOR_ROWS.map((row) => [row.id.slice(0, row.id.indexOf('(')), row.args.length])
);

const ROWS_BY_ID = new Map(TYPED_OPERATOR_ROWS.map((row) => [row.id, row]));

function typeTuples(arity) {
  if (arity === 0) return [[]];
  return typeTuples(arity - 1).flatMap((rest) => VALUE_TYPES.map((type) => [...rest, type]));
}

const OPERAND_NAMES = ['a', 'b', 'c'];

/**
 * One case. Godot reads an expression statement in a `void` function, so its verdict is the
 * operator's alone: a `return` in a `void` function is refused before the expression. The
 * transpiler reads only a function that returns one expression, so its text returns it, typed
 * by the row, or `float` where the table has none, and the error stays on the operator.
 */
function operatorCase(op, types) {
  const id = `${op}(${types.join(',')})`;
  const row = ROWS_BY_ID.get(id);
  const parameters = types.map((type, index) => `${type} ${OPERAND_NAMES[index]}`).join(', ');
  const expression = operatorExpression(op, OPERAND_NAMES.slice(0, types.length));
  return {
    id,
    row,
    godotText: `shader_type canvas_item; void f(${parameters}) { ${expression}; }`,
    transpilerText: `${row?.returns ?? 'float'} f(${parameters}) { return ${expression}; }`,
  };
}

export const OPERATOR_CASES = [...ARITY].flatMap(([op, arity]) =>
  typeTuples(arity).map((types) => operatorCase(op, types))
);
