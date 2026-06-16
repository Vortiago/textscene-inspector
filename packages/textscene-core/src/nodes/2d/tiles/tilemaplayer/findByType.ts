/** Recursively collect every node of a given type from a TscnNode tree. */
import type { TscnNode } from '../../../../parser/types';

export function findByType(
  nodes: readonly TscnNode[],
  type: string,
  out: TscnNode[] = []
): TscnNode[] {
  for (const node of nodes) {
    if (node.type === type) out.push(node);
    findByType(node.children, type, out);
  }
  return out;
}
