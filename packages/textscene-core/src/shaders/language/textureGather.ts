import * as TSL from 'three/tsl';
import type { Node, TextureNode } from 'three/webgpu';
import { cubeFaceOf, directionOf, footprintOf } from './cubeFaces.js';
import { SizeNode } from './textureSize.js';
import { textureKindOf } from './types.js';
import { untyped } from './compositeParts.js';

/** A cube gather, which three lacks: the four texel centres around the face point, in Vulkan's order. */
function cubeGathered(textureNode: TextureNode, direction: Node, channel: Node): Node {
  const face = cubeFaceOf(direction);
  const size = TSL.vec2(untyped(new SizeNode(textureNode, TSL.int(0) as never, 'ivec2')));
  const { centre } = footprintOf(face, size as unknown as Node);
  const read = (st: Node): never =>
    untyped(
      TSL.element(
        untyped(textureNode.sample(directionOf(face, st)).level(TSL.float(0) as never)),
        untyped(channel)
      )
    );
  return TSL.vec4(
    read(centre(0, 1)),
    read(centre(1, 1)),
    read(centre(1, 0)),
    read(centre(0, 0))
  ) as unknown as Node;
}

/** `textureGather` of channel `channel`, 0 when the call names none. */
export function gathered(sampler: string, sampledNode: TextureNode, coordinate: Node, channel?: Node): Node {
  const component = channel ?? (TSL.int(0) as unknown as Node);
  if (textureKindOf(sampler) === 'cube') return cubeGathered(sampledNode, coordinate, component);
  return sampledNode.gather(component as never) as unknown as Node;
}
