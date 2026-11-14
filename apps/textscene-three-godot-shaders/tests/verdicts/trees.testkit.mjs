/**
 * The parsed tree of a shader text for the tests that check trees: the tree as the parser gives
 * it, the tree the emitter walks, and its shape without positions, which differ between a text and
 * its printed form.
 */

import { emittedShader } from '../../../../packages/textscene-core/src/shaders/language/emittedTree.ts';
import { parse } from '../../../../packages/textscene-core/src/shaders/language/parse.ts';
import { tokenize } from '../../../../packages/textscene-core/src/shaders/language/tokenizer.ts';
import { treeFault } from '../../../../packages/textscene-core/src/shaders/language/treeCheck.ts';

export const treeOf = (source) => parse(tokenize(source));

/** The tree the emitter walks, which Godot's printed-text check reads too. */
export const loweredTreeOf = (source) => emittedShader(treeOf(source));

export const shapeOf = (tree) =>
  JSON.parse(JSON.stringify(tree, (key, value) => (key === 'position' ? undefined : value)));

/** The flows the lowering removes: the emitter reads `while (true)` as its one loop and no `switch`. */
const LOWERED_AWAY = { FLOW_OP_FOR: 'a for loop', FLOW_OP_DO: 'a do loop', FLOW_OP_SWITCH: 'a switch' };

/**
 * The first fact a lowered tree breaks: a fault of the tree check, a loop or a switch the
 * lowering removes, a `while` whose condition is not `true`, or a `return` before a function's
 * last statement. Nothing when it holds them all.
 */
export function loweredFault(tree) {
  const fault = treeFault(tree);
  if (fault !== undefined) return fault;
  for (const definition of tree.functions) {
    const found = leftoverIn(definition.body, true);
    if (found !== undefined) return `${definition.name}: ${found} after lowering`;
  }
  return undefined;
}

function leftoverIn(block, isFunctionBody) {
  const last = block.statements.length - 1;
  for (const [index, statement] of block.statements.entries()) {
    const found = leftoverAt(statement, isFunctionBody && index === last);
    if (found !== undefined) return found;
  }
  return undefined;
}

function leftoverAt(statement, isLastOfFunction) {
  if (statement.kind === 'block') return leftoverIn(statement, false);
  if (statement.kind !== 'control flow') return undefined;
  if (statement.flow in LOWERED_AWAY) return LOWERED_AWAY[statement.flow];
  if (statement.flow === 'FLOW_OP_WHILE' && !isTrue(statement.expressions[0]))
    return 'a while loop with a condition';
  if (statement.flow === 'FLOW_OP_RETURN' && !isLastOfFunction) return 'a return before the last statement';
  for (const inner of statement.blocks) {
    const found = leftoverIn(inner, false);
    if (found !== undefined) return found;
  }
  return undefined;
}

const isTrue = (expression) => expression?.kind === 'constant' && expression.values?.[0] === true;
