import type { Texture } from 'three';
import * as TSL from 'three/tsl';
import { UniformNode, type Node, type TextureNode } from 'three/webgpu';
import { lastLevelOf, levelsOf } from '../uniforms/textureLevels.js';
import { cubeFaceOf, type CubeFace } from './cubeFaces.js';
import { SizeNode } from './textureSize.js';
import { textureKindOf } from './types.js';
import { untyped } from './compositeParts.js';

type TextureFact = (texture: Texture) => number;

/** An `int` uniform that three reads from the texture a node holds now, at each render. */
class TextureFactNode extends UniformNode<'int', number> {
  constructor(textureNode: TextureNode, fact: TextureFact) {
    super(0, 'int');
    Object.defineProperty(this, 'value', {
      get: () => fact(textureNode.value),
      set: () => {
        // The texture node decides the value: a write of the uniform changes nothing.
      },
    });
  }
}

/** Written only by `factNodeOf`: one uniform per texture node and fact, kept while the node lives. */
// eslint-disable-next-line no-restricted-syntax -- perObject is outside the shader module, which imports only its own files (ADR-0072).
const FACT_NODES = new WeakMap<TextureNode, Map<TextureFact, TextureFactNode>>();

function factNodeOf(textureNode: TextureNode, fact: TextureFact): TextureFactNode {
  let facts = FACT_NODES.get(textureNode);
  if (!facts) FACT_NODES.set(textureNode, (facts = new Map()));
  let node = facts.get(fact);
  if (!node) facts.set(fact, (node = new TextureFactNode(textureNode, fact)));
  return node;
}

/** `textureQueryLevels`: GLSL ES 3.0 has no such function, so a uniform holds the count. */
export const levelCountOf = (textureNode: TextureNode): UniformNode<'int', number> =>
  factNodeOf(textureNode, levelsOf);

const sizeOf = (textureNode: TextureNode, type: string): Node =>
  new SizeNode(textureNode, TSL.int(0) as never, type) as unknown as Node;

/** The derivatives of a cube's face coordinate by the quotient rule of Vulkan's cube transform. */
function faceDerivatives(face: CubeFace, direction: Node, changes: readonly Node[]): readonly Node[] {
  const reach = TSL.dot(untyped(direction), untyped(face.axis));
  return changes.map((directionChange) => {
    const change = untyped(directionChange);
    const lane = (axis: Node) =>
      TSL.sub(
        TSL.mul(TSL.dot(change, untyped(axis)), reach),
        TSL.mul(TSL.dot(untyped(direction), untyped(axis)), TSL.dot(change, untyped(face.axis)))
      );
    const quotient = TSL.div(TSL.vec2(lane(face.sAxis), lane(face.tAxis)), TSL.mul(reach, reach));
    return TSL.mul(quotient, 0.5) as unknown as Node;
  });
}

const screenDerivatives = (node: Node): readonly Node[] =>
  [TSL.dFdx(untyped(node)), TSL.dFdy(untyped(node))] as unknown as Node[];

/** The derivatives of a cube direction in texels of `face` with `size` texels, from its own derivatives. */
function cubeTexelDerivatives(
  face: CubeFace,
  size: Node,
  direction: Node,
  changes: readonly Node[]
): readonly Node[] {
  return faceDerivatives(face, direction, changes).map(
    (derivative) => TSL.mul(untyped(derivative), untyped(size)) as unknown as Node
  );
}

/** The two derivatives of the coordinate in texels, by the sampler's kind. */
function texelDerivatives(sampler: string, textureNode: TextureNode, coordinate: Node): readonly Node[] {
  const kind = textureKindOf(sampler);
  if (kind === 'cube') {
    const size = TSL.vec2(untyped(sizeOf(textureNode, 'ivec2'))) as unknown as Node;
    return cubeTexelDerivatives(cubeFaceOf(coordinate), size, coordinate, screenDerivatives(coordinate));
  }
  const isVolume = kind === 'volume';
  const size = (isVolume ? TSL.vec3 : TSL.vec2)(untyped(sizeOf(textureNode, isVolume ? 'ivec3' : 'ivec2')));
  return screenDerivatives(TSL.mul(untyped(coordinate), size) as unknown as Node);
}

/** Vulkan's unclamped level of detail: log2 of the longer of two texel derivatives. */
// Half the log2 of the squared length (`lp_bld_sample.c:948`): `length(vec2(0))` is NaN on some drivers.
const levelOfTexelDerivatives = ([dx, dy]: readonly Node[]): Node => {
  const squared = TSL.max(TSL.dot(untyped(dx), untyped(dx)), TSL.dot(untyped(dy), untyped(dy)));
  return TSL.mul(TSL.log2(squared), 0.5) as unknown as Node;
};

/** The last level a texture node's sampler reads, as a float uniform. */
export const lastLevelNodeOf = (textureNode: TextureNode): Node =>
  TSL.float(untyped(factNodeOf(textureNode, lastLevelOf))) as unknown as Node;

/** The unclamped level of detail on `face` of `size` texels, from the derivatives of the direction. */
export const cubeLevelOf = (face: CubeFace, size: Node, direction: Node, changes: readonly Node[]) =>
  levelOfTexelDerivatives(cubeTexelDerivatives(face, size, direction, changes));

/** `textureQueryLod`: Vulkan's level of detail, clamped to the levels read, then unclamped. */
export function levelOfDetail(sampler: string, textureNode: TextureNode, coordinate: Node): Node {
  const level = levelOfTexelDerivatives(texelDerivatives(sampler, textureNode, coordinate));
  return TSL.vec2(
    TSL.clamp(untyped(level), 0, untyped(lastLevelNodeOf(textureNode))),
    untyped(level)
  ) as unknown as Node;
}
