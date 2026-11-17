import type { ArrayValue, Value } from '../language/emitValue.js';

/** The buffer node under a uniform's value: the words it holds, and the array three uploads. */
interface BitsNode {
  readonly bits: Uint32Array;
  readonly value: ArrayBufferView;
}

/** The buffer node a uniform's value reads, found through the node graph as the GPU would read it. */
export function bitsNodeOf(value: Value): BitsNode {
  const seen = new Set<unknown>();
  const visit = (item: unknown): BitsNode | undefined => {
    if (!item || typeof item !== 'object' || seen.has(item)) return undefined;
    seen.add(item);
    if ('bits' in item && item.bits instanceof Uint32Array) return item as BitsNode;
    for (const child of Object.values(item)) {
      const found = visit(child);
      if (found) return found;
    }
    return undefined;
  };
  const node = (value as ArrayValue).kind === 'array' ? (value as ArrayValue).element(0) : value;
  return visit(node)!;
}

/** The words the buffer uploads. */
export const wordsOf = (value: Value): Uint32Array => bitsNodeOf(value).bits;
