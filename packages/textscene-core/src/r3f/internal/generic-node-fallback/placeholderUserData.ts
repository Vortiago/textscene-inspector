/**
 * The `userData` marker of a node that draws nothing of its own, for tooling and tests. Its two
 * publishers share this shape: `GenericNodeFallback` for an unregistered type, and `PlainNode` for
 * a `renderIntent: 'pending'` type, whose base component runs instead of the fallback.
 */

import type { TscnNode } from '../../../parser/types';

/**
 * A type alias, not an interface: THREE's `userData` is an index-signature
 * type, and only an alias carries the implicit index signature that assignment
 * needs.
 */
export type PlaceholderUserData = {
  isPlaceholder: true;
  nodeType: string;
  nodeName: string;
};

export function placeholderUserData(node: TscnNode): PlaceholderUserData {
  return { isPlaceholder: true, nodeType: node.type, nodeName: node.name };
}
