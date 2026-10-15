/** The ancestry walk the linter guards read, which production asks only through `descendsFrom`. */

import { NODE_BASE_TYPES } from '../classdb/nodeBaseTypes.js';

/**
 * Every ancestor of `nodeType`, nearest first, excluding the type itself. Cycle-safe, so a malformed
 * table truncates. `Object.hasOwn`, as a `.tscn` chooses the key: bare indexing answers a function for
 * `type="constructor"` or `type="__proto__"`.
 */
export function baseChain(nodeType: string): string[] {
  const baseOf = (type: string) => (Object.hasOwn(NODE_BASE_TYPES, type) ? NODE_BASE_TYPES[type] : undefined);
  const chain: string[] = [];
  const seen = new Set<string>([nodeType]);
  let current = baseOf(nodeType);
  while (current && !seen.has(current)) {
    seen.add(current);
    chain.push(current);
    current = baseOf(current);
  }
  return chain;
}
