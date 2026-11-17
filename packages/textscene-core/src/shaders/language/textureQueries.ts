import type { Texture } from 'three';
import * as TSL from 'three/tsl';
import { UniformNode, type Node, type TextureNode } from 'three/webgpu';
import { lastLevelOf, levelsOf } from '../uniforms/textureLevels.js';
import { cubeFaceOf, type CubeFace } from './cubeFaces.js';
import { SizeNode } from './textureSize.js';

const tsl = (node: unknown) => node as never;

/** An `int` uniform that three reads from the texture a node holds now, at each render. */
class TextureFactNode extends UniformNode<'int', number> {
  constructor(textureNode: TextureNode, fact: (texture: Texture) => number) {
    super(0, 'int');
    Object.defineProperty(this, 'value', {
      get: () => fact(textureNode.value),
      set: () => {
        // The texture node decides the value: a write of the uniform changes nothing.
      },
    });
  }
}

/** `textureQueryLevels`: GLSL ES 3.0 has no such function, so a uniform holds the count. */
export const levelCountOf = (textureNode: TextureNode): UniformNode<'int', number> =>
  new TextureFactNode(textureNode, levelsOf);

const sizeOf = (textureNode: TextureNode, type: string): Node =>
  new SizeNode(textureNode, TSL.int(0) as never, type) as unknown as Node;

/** The derivatives of a cube's face coordinate by the quotient rule of Vulkan's cube transform. */
function faceDerivatives(face: CubeFace, direction: Node): readonly Node[] {
  const reach = TSL.dot(tsl(direction), tsl(face.axis));
  return [TSL.dFdx, TSL.dFdy].map((derivative) => {
    const change = tsl(derivative(tsl(direction)));
    const lane = (axis: Node) =>
      TSL.sub(
        TSL.mul(TSL.dot(change, tsl(axis)), reach),
        TSL.mul(TSL.dot(tsl(direction), tsl(axis)), TSL.dot(change, tsl(face.axis)))
      );
    const quotient = TSL.div(TSL.vec2(lane(face.sAxis), lane(face.tAxis)), TSL.mul(reach, reach));
    return TSL.mul(quotient, 0.5) as unknown as Node;
  });
}

/** The two derivatives of the coordinate in texels, by the sampler's kind. */
function texelDerivatives(sampler: string, textureNode: TextureNode, coordinate: Node): readonly Node[] {
  if (sampler.endsWith('samplerCube')) {
    const size = TSL.vec2(tsl(sizeOf(textureNode, 'ivec2')));
    return faceDerivatives(cubeFaceOf(coordinate), coordinate).map(
      (derivative) => TSL.mul(tsl(derivative), size) as unknown as Node
    );
  }
  const isVolume = sampler.endsWith('sampler3D');
  const size = (isVolume ? TSL.vec3 : TSL.vec2)(tsl(sizeOf(textureNode, isVolume ? 'ivec3' : 'ivec2')));
  const texels = TSL.mul(tsl(coordinate), size);
  return [TSL.dFdx(texels), TSL.dFdy(texels)] as unknown as Node[];
}

/** Vulkan's level of detail: log2 of the longer texel derivative, then clamped to the levels read. */
export function levelOfDetail(sampler: string, textureNode: TextureNode, coordinate: Node): Node {
  const [dx, dy] = texelDerivatives(sampler, textureNode, coordinate);
  const longest = TSL.max(TSL.length(tsl(dx)), TSL.length(tsl(dy)));
  const level = TSL.log2(longest);
  const lastLevel = TSL.float(tsl(new TextureFactNode(textureNode, lastLevelOf)));
  return TSL.vec2(TSL.clamp(level, 0, lastLevel), level) as unknown as Node;
}
