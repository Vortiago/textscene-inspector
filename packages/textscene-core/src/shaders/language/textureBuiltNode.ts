import { Node as TslNode, NodeUpdateType, type Node, type NodeFrame } from 'three/webgpu';

/**
 * A read whose program depends on the bound texture: three's program key misses it, so dispose rebuilds.
 * @canonical Rebuild the program when the bound texture needs another one.
 */
export abstract class TextureBuiltNode extends TslNode {
  override updateType = NodeUpdateType.RENDER;
  /** Written only by `setup`: the key of the texture three built the program from. */
  private builtKey: string | undefined;

  /** What decides the program, read from the texture bound now. */
  protected abstract keyOf(): string;

  /** The composite for the texture bound now. */
  protected abstract composite(): Node;

  override setup(): Node {
    this.builtKey = this.keyOf();
    return this.composite();
  }

  override update(frame: NodeFrame): undefined {
    if (this.builtKey !== undefined && this.builtKey !== this.keyOf()) frame.material!.dispose();
    return undefined;
  }
}
