/** The printed text of a function after a lowering, for the lowerings' unit tests. */

import { treeOf } from '../parsedTree.testkit.js';
import { printShader } from '../printer.js';
import type { FunctionNode } from '../shaderTree.js';
import { treeFault } from '../treeCheck.js';
import { FreshNames } from './freshNames.js';

type Lowering = (definition: FunctionNode, names: FreshNames) => FunctionNode;

/**
 * The text of the last function of `source` after `lower`, which must pass the tree check beside
 * the functions before it. The functions before it are left out of the text.
 */
export function loweredText(lower: Lowering, source: string): string {
  const shader = treeOf(source);
  const definition = shader.functions.at(-1)!;
  const lowered = lower(definition, new FreshNames(definition));
  const fault = treeFault({ ...shader, functions: [...shader.functions.slice(0, -1), lowered] });
  if (fault !== undefined)
    throw new Error(`expected a lowered tree that passes the tree check, got ${fault}`);
  return printShader({ ...shader, functions: [lowered] });
}

/** `lines` as a function's text: a tab per level of the array they nest in. */
export function text(...lines: readonly (string | readonly unknown[])[]): string {
  const indented = (items: readonly unknown[], depth: number): string[] =>
    items.flatMap((item) =>
      Array.isArray(item) ? indented(item, depth + 1) : [`${'\t'.repeat(depth)}${item}`]
    );
  return indented(lines, 0).join('\n');
}
