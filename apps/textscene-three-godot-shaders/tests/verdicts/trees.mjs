/**
 * The parsed tree of a shader text for the tests that check trees: the tree as the parser gives
 * it, the tree after lowering, and its shape without positions, which differ between a text and
 * its printed form.
 */

import { lowerFunction } from '../../../../packages/textscene-core/src/shaders/language/lowering/lower.ts';
import { parse } from '../../../../packages/textscene-core/src/shaders/language/parse.ts';
import { tokenize } from '../../../../packages/textscene-core/src/shaders/language/tokenizer.ts';

export const treeOf = (source) => parse(tokenize(source));

export const loweredTreeOf = (source) => {
  const tree = treeOf(source);
  return { ...tree, functions: tree.functions.map(lowerFunction) };
};

export const shapeOf = (tree) =>
  JSON.parse(JSON.stringify(tree, (key, value) => (key === 'position' ? undefined : value)));
