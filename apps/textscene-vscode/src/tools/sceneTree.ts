/**
 * Formats a scene's node hierarchy as indented text, so a language model reads the
 * structure without parsing the `.tscn` itself. The lenient parser builds the tree the
 * preview uses, so the outline matches what the user sees.
 */

import { TscnParser, type TscnNode } from '@textscene/core/parser';

/** The scene tree as text, one node per line, children indented. */
export function formatSceneTree(fileName: string, content: string): string {
  const scene = new TscnParser().parse(content);
  const lines = [`${fileName}:`];
  const walk = (nodes: readonly TscnNode[], depth: number): void => {
    for (const node of nodes) {
      const instance = node.instance ? ` instance=${node.instance}` : '';
      lines.push(`${'  '.repeat(depth)}${node.name} (${node.type})${instance}`);
      walk(node.children, depth + 1);
    }
  };
  walk(scene.nodes, 1);
  return lines.join('\n');
}
