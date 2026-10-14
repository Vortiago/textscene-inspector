/**
 * A raw read of a shadow atlas's depth. Each atlas compares under a linear filter
 * (`atlasDepthTexture.ts`), and a shader can read a depth texture's raw value only uncompared and
 * unfiltered (OpenGL ES 3.0 §3.8.13). So a pass that reads one turns both off for its draw and back
 * on after.
 */

import type * as THREE from 'three';

/**
 * Runs `draw` with each of `atlases` readable raw, and gives each its compare and linear filter
 * back after, even when `draw` throws. A null atlas, and one no shadow pass has drawn, which has no
 * texture yet, stay as they are. three sets a texture's parameters only when it uploads it, so it
 * never sees the change.
 */
export function drawWithUncomparedDepth(
  renderer: THREE.WebGLRenderer,
  atlases: readonly (THREE.DepthTexture | null)[],
  draw: () => void
): void {
  const gl = renderer.getContext() as WebGL2RenderingContext;
  for (const atlas of atlases) setAtlasParameters(renderer, atlas, gl.NONE, gl.NEAREST);
  try {
    draw();
  } finally {
    for (const atlas of atlases) setAtlasParameters(renderer, atlas, gl.COMPARE_REF_TO_TEXTURE, gl.LINEAR);
  }
}

function setAtlasParameters(
  renderer: THREE.WebGLRenderer,
  atlas: THREE.DepthTexture | null,
  compareMode: number,
  filter: number
): void {
  if (!atlas) return;
  const handle = (renderer.properties.get(atlas) as { __webglTexture?: WebGLTexture }).__webglTexture;
  if (!handle) return;
  const gl = renderer.getContext() as WebGL2RenderingContext;
  renderer.state.bindTexture(gl.TEXTURE_2D, handle);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_MODE, compareMode);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
}
