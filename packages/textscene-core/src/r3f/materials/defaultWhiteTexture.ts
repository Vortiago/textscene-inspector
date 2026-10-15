/**
 * Godot's `DEFAULT_RD_TEXTURE_WHITE`: the texture a material sampler reads when the RID its slot
 * holds names no texture, whatever the sampler's hint (`material_storage.cpp:1094-1096`).
 */

import * as THREE from 'three';

/** Written once, on the first request. Never disposed: every such slot shares it. */
let white: THREE.DataTexture | undefined;

export function defaultWhiteTexture(): THREE.DataTexture {
  if (white) return white;
  white = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
  white.needsUpdate = true;
  return white;
}
