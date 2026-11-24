import { treeOf } from '../parsedTree.testkit.js';
import { printShader } from '../printer.js';
import type { FunctionNode } from '../shaderTree.js';
import { treeFault } from '../treeCheck.js';
import { FreshNames } from './freshNames.js';

type Lowering = (definition: FunctionNode, names: FreshNames) => FunctionNode;

/** The functions before the last pass the tree check but are left out of the text. */
export function loweredText(lower: Lowering, source: string): string {
  const shader = treeOf(source);
  const definition = shader.functions.at(-1)!;
  const lowered = lower(definition, new FreshNames(definition));
  const tree = { ...shader, functions: [...shader.functions.slice(0, -1), lowered] };
  const fault = treeFault(tree);
  if (fault !== undefined)
    throw new Error(`expected a lowered tree that passes the tree check, got ${fault}`);
  const last = shader.functions.length - 1;
  return printShader({
    ...tree,
    order: shader.order.filter((entry) => entry.kind !== 'function' || entry.index === last),
  });
}

/** `lines` as a function's text: a tab per level of the array they nest in. */
export function text(...lines: readonly (string | readonly unknown[])[]): string {
  const indented = (items: readonly unknown[], depth: number): string[] =>
    items.flatMap((item) =>
      Array.isArray(item) ? indented(item, depth + 1) : [`${'\t'.repeat(depth)}${item}`]
    );
  return indented(lines, 0).join('\n');
}
