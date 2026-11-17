import { Node as TslNode, NodeUpdateType, type Node, type NodeFrame } from 'three/webgpu';

/**
 * A read whose program depends on the bound texture: three's program key misses it, so dispose rebuilds.
 * @canonical Rebuild the program when the bound texture needs another one.
 */
export abstract class TextureBuiltNode<Key extends string | boolean> extends TslNode {
  override updateType = NodeUpdateType.RENDER;
  /** Written only by `setup`: the key three built the program from. */
  private builtKey: Key | undefined;

  /** What decides the program, read from the texture bound now: a primitive, so a frame allocates nothing. */
  protected abstract keyOf(): Key;

  /** The composite for `key`. three sets it up once for every stage that reaches it. */
  protected abstract composite(key: Key): Node;

  override setup(): Node {
    this.builtKey = this.keyOf();
    return this.composite(this.builtKey);
  }

  override update(frame: NodeFrame): undefined {
    if (this.builtKey !== undefined && this.builtKey !== this.keyOf()) frame.material!.dispose();
    return undefined;
  }
}
