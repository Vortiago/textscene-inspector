/**
 * The render target of a shadow atlas that the soft shadow filter samples: its depth texture and
 * the colour copy three keeps beside it.
 */

import * as THREE from 'three';
import { AtlasColourTexture } from './atlasColourTexture.js';
import { AtlasDepthTexture, type AtlasDepth } from './atlasDepthTexture.js';

/** The render target `depth` belongs to, or null for anything else, such as an uninstalled uniform. */
export function atlasTargetOf(depth: unknown): THREE.WebGLRenderTarget | null {
  if (!(depth instanceof THREE.DepthTexture)) return null;
  return depth.renderTarget instanceof THREE.WebGLRenderTarget ? depth.renderTarget : null;
}

/**
 * A shadow atlas as three builds a PCF shadow map (r186 `WebGLShadowMap.js:253-266`): the depth
 * texture `depth` describes, and its colour copy named after it.
 */
export function createShadowAtlas(depth: AtlasDepth): THREE.WebGLRenderTarget {
  const atlas = new THREE.WebGLRenderTarget(depth.size, depth.size);
  atlas.texture = new AtlasColourTexture(`${depth.name}Colour`, depth.size);
  atlas.depthTexture = new AtlasDepthTexture(depth);
  return atlas;
}
