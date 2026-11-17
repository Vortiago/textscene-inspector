import { Node as TslNode, NodeUpdateType, type Node, type NodeBuilder, type NodeFrame } from 'three/webgpu';

/**
 * A read whose program depends on the bound texture: three's program key misses it, so dispose rebuilds.
 * @canonical Rebuild the program when the bound texture needs another one.
 */
export abstract class TextureBuiltNode<Facts> extends TslNode {
  override updateType = NodeUpdateType.RENDER;
  /** Written only by `setup`: the facts three built the program from, as text. */
  private builtKey: string | undefined;

  /** What decides the program, read from the texture bound now. */
  protected abstract factsOf(): Facts;

  /** The composite for `facts`, in the stage that `builder` builds. */
  protected abstract composite(facts: Facts, builder: NodeBuilder): Node;

  override setup(builder: NodeBuilder): Node {
    const facts = this.factsOf();
    this.builtKey = JSON.stringify(facts);
    return this.composite(facts, builder);
  }

  override update(frame: NodeFrame): undefined {
    if (this.builtKey !== undefined && this.builtKey !== JSON.stringify(this.factsOf()))
      frame.material!.dispose();
    return undefined;
  }
}
