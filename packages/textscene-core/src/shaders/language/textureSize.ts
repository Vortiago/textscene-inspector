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

/** GLSL's size of one layer of a layer array: the `.xy` of its `ivec3`, as Godot's `sampler2D` reads. */
export function arrayLayerSize(texture: TextureNode, level: Node): Node {
  return swizzles(new SizeNode(texture, level, 'ivec3') as unknown as Node).xy as unknown as Node;
}

/** Whether `texture` is a layer array that a 2D call reads, which three declares as a `sampler2DArray`. */
export function isArrayLayerRead(texture: TextureNode, returns: string): boolean {
  return (
    returns === 'ivec2' && (texture.value as { isDataArrayTexture?: boolean }).isDataArrayTexture === true
  );
}
