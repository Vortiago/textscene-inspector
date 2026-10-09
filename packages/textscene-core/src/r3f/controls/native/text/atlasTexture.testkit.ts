/** Holds back every `TextureLoader` image decode until the test asks for it. */

import { vi } from 'vitest';
import * as THREE from 'three';

/** Mocks `TextureLoader.load` and returns the call that decodes every image loaded so far. */
export function deferTextureDecodes(): () => void {
  const decodes: Array<() => void> = [];
  vi.spyOn(THREE.TextureLoader.prototype, 'load').mockImplementation((_url, onLoad) => {
    const texture = new THREE.Texture<HTMLImageElement>();
    decodes.push(() => onLoad?.(texture));
    return texture;
  });
  return () => decodes.forEach((decode) => decode());
}
