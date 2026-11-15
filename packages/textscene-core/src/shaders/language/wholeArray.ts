import { Node } from 'three/webgpu';
import type { NodeBuilder } from 'three/webgpu';

class WholeArray extends Node {
  constructor(
    private readonly array: Node,
    private readonly arrayType: string
  ) {
    super(arrayType);
  }

  override getElementType(): string {
    return this.arrayType.slice(0, this.arrayType.indexOf('['));
  }

  override generate(builder: NodeBuilder): string {
    return this.array.build(builder) as string;
  }
}

export const isArrayType = (type: string) => type.endsWith(']');

/** `leaves`, each of an array type in `types` typed as the whole array. */
export function wholeArrays(leaves: readonly Node[], types: readonly string[]): Node[] {
  return leaves.map((leaf, index) =>
    isArrayType(types[index]!) ? new WholeArray(leaf, types[index]!) : leaf
  );
}
