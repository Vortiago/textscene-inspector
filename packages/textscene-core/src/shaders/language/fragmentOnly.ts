import { Node as TslNode, type Node, type NodeBuilder } from 'three/webgpu';

/**
 * A fragment-only value and its stand-in elsewhere, picked in `generate`: three sets a node up once.
 * @canonical Pick a value by the stage three generates, for a node that both stages reach.
 */
export class FragmentOnlyNode extends TslNode {
  constructor(
    private readonly fragment: Node,
    private readonly elsewhere: Node
  ) {
    super();
  }

  override getNodeType(builder: NodeBuilder): string {
    return this.fragment.getNodeType(builder);
  }

  override generate(builder: NodeBuilder, output?: string | null): string {
    const chosen = (builder as unknown as { shaderStage: string }).shaderStage === 'fragment';
    return (chosen ? this.fragment : this.elsewhere).build(builder, output) as string;
  }
}
