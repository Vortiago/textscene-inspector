/**
 * The trees Godot 4.6.3 gives values for, which a random program must be. Godot's front end
 * evaluates an operator of constants (`_eval_operator`, `shader_language.cpp:2065`): it refuses
 * an integer division or modulo by a zero it knows, and it ends the process on `mat4 * vec4` of
 * constants and on the least `int` divided by -1. A divisor that holds no parameter is therefore
 * a nonzero literal, and the product holds a parameter. Godot calls the first overload of a
 * built-in function whose arguments fit, a scalar constant fitting any scalar type it converts to
 * (`shader_language.cpp:3646`), so a call's row must be that first overload.
 */

import { INSTRUCTION_TABLE } from '../../../../packages/textscene-core/src/shaders/language/instructionTable.generated.ts';
import { operatorOf } from '../operators/operatorText.mjs';
import { treeNodes } from './programTree.mjs';

/** Whether `node` holds no parameter, so Godot's front end may know its values. */
const isConstant = (node) => treeNodes(node).every((each) => each.kind !== 'parameter');

const isNonzeroLiteral = (node) => node.kind === 'literal' && Number.parseFloat(node.text) !== 0;

const INTEGER_TYPE = /^(u?int|[iu]vec\d)$/;

/** Whether Godot gives values for `node`'s operator alone, its operands aside. */
function isAnswerableOperator(node) {
  if (node.kind !== 'operator') return true;
  const [left, right] = node.operands;
  if (node.row.id === 'OP_MUL(mat4,vec4)') return !(isConstant(left) && isConstant(right));
  if (node.op !== 'OP_DIV' && node.op !== 'OP_MOD') return true;
  if (!INTEGER_TYPE.test(node.type)) return true;
  return !isConstant(right) || isNonzeroLiteral(right);
}

/** The overloads of each built-in function, in the order of Godot's `builtin_func_defs`. */
const OVERLOADS = Map.groupBy(
  INSTRUCTION_TABLE.filter((row) => row.family === 'function' && row.args),
  (row) => operatorOf(row)
);

const SCALAR = /^(int|uint|float)$/;

/**
 * Whether `child` fits an argument of `type`: its own type, or a scalar that holds no parameter,
 * which Godot may hold as a constant and convert. The second reading is wider than Godot's, so a
 * tree it doubts is drawn again.
 */
const mayFit = (child, type) =>
  child.type === type || (SCALAR.test(type) && SCALAR.test(child.type) && isConstant(child));

/** Whether Godot calls `node`'s own row: no overload before it takes the arguments. */
function isCalledAsWritten(node) {
  if (node.kind !== 'call' || node.row.family !== 'function') return true;
  const overloads = OVERLOADS.get(operatorOf(node.row)) ?? [];
  const earlier = overloads.slice(0, overloads.indexOf(node.row));
  return !earlier.some(
    (row) =>
      row.args.length === node.args.length && row.args.every((type, index) => mayFit(node.args[index], type))
  );
}

/** Whether Godot 4.6.3 gives values for a shader with the tree of `node`. */
export function isAnswerable(node) {
  return treeNodes(node).every((each) => isAnswerableOperator(each) && isCalledAsWritten(each));
}
