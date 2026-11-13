/**
 * The trees Godot 4.6.3 gives values for, which a random program must be. Godot's front end
 * evaluates an operator of constants (`_eval_operator`, `shader_language.cpp:2065`): it refuses
 * an integer division or modulo by a zero it knows, and it ends the process on `mat4 * vec4` of
 * constants and on the least `int` divided by -1. A divisor that holds no parameter is therefore
 * a nonzero literal, and the product holds a parameter.
 */

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

/** Whether Godot 4.6.3 gives values for a shader with the tree of `node`. */
export function isAnswerable(node) {
  return treeNodes(node).every(isAnswerableOperator);
}
