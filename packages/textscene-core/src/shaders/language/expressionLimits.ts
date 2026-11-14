/**
 * The limits of the expressions the transpiler reads. Godot sets none, but each nesting level costs
 * the parser and the emitter stack frames, and the browser's stack is short.
 */

import type { Expression } from './shaderTree.js';

/** The deepest tree of one expression, and the deepest nesting of brackets and parts. */
export const MAX_EXPRESSION_DEPTH = 256;

/** The most operands and operators in one list `_parse_expression` reduces, which takes time squared. */
export const MAX_LIST_ENTRIES = 4096;

export const DEPTH_MESSAGE = `The expression nests deeper than ${MAX_EXPRESSION_DEPTH} levels, which the transpiler does not read.`;

export const LENGTH_MESSAGE = `The expression holds more than ${MAX_LIST_ENTRIES} operands and operators, which the transpiler does not read.`;

/** The depth of `expression`'s tree, counted without recursion, so any depth gets an answer. */
export function expressionDepth(expression: Expression): number {
  let deepest = 0;
  const pending: [Expression, number][] = [[expression, 1]];
  while (pending.length > 0) {
    const [node, depth] = pending.pop()!;
    deepest = Math.max(deepest, depth);
    if (node.kind === 'member') pending.push([node.owner, depth + 1]);
    if (node.kind === 'operator') for (const operand of node.operands) pending.push([operand, depth + 1]);
  }
  return deepest;
}
