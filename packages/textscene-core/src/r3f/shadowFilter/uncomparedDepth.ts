/**
 * A raw read of a shadow atlas's depth. Each atlas compares under a linear filter, and a shader can
 * read a depth texture's raw value only uncompared and unfiltered (OpenGL ES 3.0 §3.8.13). So a pass
 * that reads one turns both off for its draw and back on after.
 */

import type * as THREE from 'three';

/** The texture parameters the read changes, and the value each takes for it. */
function rawParameters(gl: WebGL2RenderingContext): [name: number, raw: number][] {
  return [
    [gl.TEXTURE_COMPARE_MODE, gl.NONE],
    [gl.TEXTURE_MIN_FILTER, gl.NEAREST],
    [gl.TEXTURE_MAG_FILTER, gl.NEAREST],
  ];
}

/**
 * Runs `draw` with each of `atlases` readable raw, and restores each one's parameters after, even
 * when `draw` throws. An atlas no shadow pass has drawn has no texture yet, and stays as it is.
 * three sets a texture's parameters only when it uploads it, so it never sees the change.
 */
export function drawWithUncomparedDepth(
  renderer: THREE.WebGLRenderer,
  atlases: readonly THREE.Texture[],
  draw: () => void
): void {
  const gl = renderer.getContext() as WebGL2RenderingContext;
  const parameters = rawParameters(gl);
  const restores: (() => void)[] = [];
  for (const atlas of atlases) {
    const handle = (renderer.properties.get(atlas) as { __webglTexture?: WebGLTexture }).__webglTexture;
    if (!handle) continue;
    renderer.state.bindTexture(gl.TEXTURE_2D, handle);
    const previous = parameters.map(([name]) => gl.getTexParameter(gl.TEXTURE_2D, name) as number);
    for (const [name, raw] of parameters) gl.texParameteri(gl.TEXTURE_2D, name, raw);
    restores.push(() => {
      renderer.state.bindTexture(gl.TEXTURE_2D, handle);
      parameters.forEach(([name], i) => gl.texParameteri(gl.TEXTURE_2D, name, previous[i]!));
    });
  }
  try {
    draw();
  } finally {
    for (const restore of restores) restore();
  }
}
