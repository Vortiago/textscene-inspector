import * as THREE from 'three';
import { nodeObject } from 'three/tsl';
import { TextureNode } from 'three/webgpu';
import { readAsStored } from './readAsStored.js';

/** Written only by `comparedTextureOf`: WebGL reads a depth compared or raw, never both (ES 3.0 §3.8.13). */
// eslint-disable-next-line no-restricted-syntax -- perObject is outside the shader module, which imports only its own files (ADR-0072).
const twins = new WeakMap<TextureNode, TextureNode>();

/** A compared read samples this while no depth is bound, as a `sampler2DShadow` needs one. */
export const UNBOUND_DEPTH: THREE.DepthTexture = (() => {
  const depth = new THREE.DepthTexture(1, 1);
  depth.compareFunction = THREE.LessEqualCompare;
  depth.needsUpdate = true;
  return depth;
})();

/** A swap of the bound depth keeps the program: three's key hashes the filters too (`TextureNode.js:274`). */
class ComparedTextureNode extends TextureNode {
  override customCacheKey(): number {
    return this.id;
  }
}

/** The node every compared read of `node`'s texture samples, made on the first call. */
export function comparedTextureOf(node: TextureNode): TextureNode {
  let twin = twins.get(node);
  if (!twin) {
    twin = nodeObject(new ComparedTextureNode(UNBOUND_DEPTH)) as unknown as TextureNode;
    readAsStored(twin);
    twins.set(node, twin);
  }
  return twin;
}
