import * as TSL from 'three/tsl';
import { TextureSizeNode, type Node, type TextureNode } from 'three/webgpu';
import { swizzles } from './compositeParts.js';
import { FACES_PER_CUBE } from './cubeFaces.js';

/** `textureSize` with the type of the row: three's node is a `uvec2`, which drops a third lane. */
export class SizeNode extends TextureSizeNode {
  constructor(textureNode: TextureNode, levelNode: Node, type: string) {
    super(textureNode, levelNode as never);
    this.nodeType = type;
  }
}

/** GLSL's size of a cube array, `ivec3(width, height, cubes)`, where Godot declares an `ivec2`. */
export function cubeArraySize(texture: TextureNode, level: Node): Node {
  const size = swizzles(new SizeNode(texture, level, 'ivec3') as unknown as Node);
  return TSL.ivec3(
    size.xy as never,
    TSL.div(size.z as never, TSL.int(FACES_PER_CUBE)) as never
  ) as unknown as Node;
}
