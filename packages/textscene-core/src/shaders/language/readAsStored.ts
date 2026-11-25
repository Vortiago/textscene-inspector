import { uniform } from 'three/tsl';
import type { TextureNode } from 'three/webgpu';

/**
 * @canonical read a render target's rows unflipped
 * Turns off three's WebGL flip of a render-target read (r187 `TextureNode.js:412`).
 */
export function readAsStored(texture: TextureNode): void {
  (texture as unknown as { _flipYUniform: unknown })._flipYUniform = uniform(false);
}
