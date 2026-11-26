import * as TSL from 'three/tsl';
import type { Node, TextureNode } from 'three/webgpu';
import { comparedTextureOf } from './comparedTextures.js';

/** A depth texture whose texels hold another depth than the one the Godot code reads and compares. */
export interface StoredDepth {
  /** The depth the Godot code reads raw at `uv`. */
  read(uv: Node): Node;
  /** The stored depth that a compare at `uv` takes for the Godot code's `reference`. */
  storedReference(uv: Node, reference: Node): Node;
}

/** Written only by `readStoredDepth`, for a texture node and its compared twin. */
// eslint-disable-next-line no-restricted-syntax -- perObject is outside the shader module, which imports only its own files (ADR-0072).
const storedDepths = new WeakMap<TextureNode, StoredDepth>();

/** Makes each raw read and each compare of `texture` go through `stored`. Call it before the emit. */
export function readStoredDepth(texture: TextureNode, stored: StoredDepth): void {
  storedDepths.set(texture, stored);
  storedDepths.set(comparedTextureOf(texture), stored);
}

export function storedDepthOf(texture: TextureNode): StoredDepth | undefined {
  return storedDepths.get(texture);
}

/** A raw read of a stored depth, as a depth texture reads: the depth in red, then 0, 0 and 1. */
export function storedDepthRead(stored: StoredDepth, uv: Node): Node {
  return TSL.vec4(stored.read(uv) as never, 0, 0, 1) as unknown as Node;
}
