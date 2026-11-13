/** Parsed trees for the unit tests of the shading language: a whole shader, and one returned value. */

import { parse } from './parse.js';
import type { Expression, ShaderNode } from './shaderTree.js';
import { tokenize } from './tokenizer.js';

/** The tree of `source`. */
export const treeOf = (source: string): ShaderNode => parse(tokenize(source));

/** The value of the first `return` of the first function of `source`. */
export function returnedValue(source: string): Expression {
  const statement = treeOf(source).functions[0]!.body.statements.find(
    (candidate) => candidate.kind === 'control flow'
  );
  if (statement?.kind !== 'control flow') throw new Error(`expected a return in ${source}`);
  return statement.expressions[0]!;
}
