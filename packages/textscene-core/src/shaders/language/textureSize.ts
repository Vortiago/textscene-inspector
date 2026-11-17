import { TextureSizeNode, type Node, type TextureNode } from 'three/webgpu';

/** `textureSize` with the type of the row: three's node is a `uvec2`, which drops a third lane. */
export class SizeNode extends TextureSizeNode {
  constructor(textureNode: TextureNode, levelNode: Node, type: string) {
    super(textureNode, levelNode as never);
    this.nodeType = type;
  }
}
