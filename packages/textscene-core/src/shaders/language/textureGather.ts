import * as TSL from 'three/tsl';
import type { Node, TextureNode } from 'three/webgpu';
import { cubeFaceOf, directionOf } from './cubeFaces.js';
import { SizeNode } from './textureSize.js';

const tsl = (node: unknown) => node as never;

type Quad = Node & Record<'xy' | 'zy' | 'xw' | 'zw', Node>;

/** A cube gather, which three lacks: the four texel centres around the face point, in Vulkan's order. */
function cubeGathered(textureNode: TextureNode, direction: Node, channel: Node): Node {
  const face = cubeFaceOf(direction);
  const size = TSL.vec2(tsl(new SizeNode(textureNode, TSL.int(0) as never, 'ivec2')));
  const corner = TSL.floor(TSL.sub(TSL.mul(tsl(face.st), size), 0.5));
  const centres = TSL.div(
    TSL.vec4(TSL.add(corner, 0.5), TSL.add(corner, 1.5)),
    TSL.vec4(size, size)
  ) as unknown as Quad;
  const read = (st: Node): never =>
    tsl(
      TSL.element(tsl(textureNode.sample(directionOf(face, st)).level(TSL.float(0) as never)), tsl(channel))
    );
  return TSL.vec4(read(centres.xw), read(centres.zw), read(centres.zy), read(centres.xy)) as unknown as Node;
}

/** `textureGather` of channel `channel`, 0 when the call names none. */
export function gathered(sampler: string, sampledNode: TextureNode, coordinate: Node, channel?: Node): Node {
  const component = channel ?? (TSL.int(0) as unknown as Node);
  if (sampler.endsWith('samplerCube')) return cubeGathered(sampledNode, coordinate, component);
  return sampledNode.gather(component as never) as unknown as Node;
}
