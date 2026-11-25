import * as TSL from 'three/tsl';
import type { Node, TextureNode } from 'three/webgpu';

/** The factor a read of one layer of a 2D array takes, from the layer the read names. */
export type LayerScale = (layer: Node) => Node;

/** Written only by `scaleLayerReads`, once for each texture node. A node no longer read is collected. */
// eslint-disable-next-line no-restricted-syntax -- perObject is outside the shader module, which imports only its own files (ADR-0072).
const layerScales = new WeakMap<TextureNode, LayerScale>();

/** Makes each sampled read of the 2D array `texture` scale its colour by `scaleOf` of its layer. */
export function scaleLayerReads(texture: TextureNode, scaleOf: LayerScale): void {
  layerScales.set(texture, scaleOf);
}

/** `read` of `layer` of `texture`, its colour scaled when the texture has a scale, its alpha as read. */
export function layerScaledRead(texture: TextureNode, read: Node, layer: Node): Node {
  const scaleOf = layerScales.get(texture);
  if (!scaleOf) return read;
  const factor = TSL.vec4(TSL.vec3(scaleOf(layer) as never), TSL.float(1));
  return TSL.mul(read as never, factor) as unknown as Node;
}
