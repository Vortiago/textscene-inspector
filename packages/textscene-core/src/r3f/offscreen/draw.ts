/** Draws into render targets of a pass's own and leaves the renderer as the caller had it. */

import * as THREE from 'three';

/**
 * Runs `draw` with `autoClear` off, then restores the target, its cube face or layer, its mip level
 * and `autoClear`, even when `draw` throws: a renderer left on a pass's target would draw the next
 * frame into it.
 */
export function drawOffscreen(renderer: THREE.WebGLRenderer, draw: () => void): void {
  const target = renderer.getRenderTarget();
  const layer = renderer.getActiveCubeFace();
  const mipmapLevel = renderer.getActiveMipmapLevel();
  const autoClear = renderer.autoClear;
  renderer.autoClear = false;
  try {
    draw();
  } finally {
    renderer.autoClear = autoClear;
    renderer.setRenderTarget(target, layer, mipmapLevel);
  }
}

/** The colour of a target no clear has touched. */
export const BLACK = new THREE.Color(0, 0, 0);

/**
 * The previous clear colour, reused so no pass allocates a `THREE.Color` per frame.
 * Written only by `renderToOffscreenTarget`. Safe as a module scratch because the
 * one orchestrator (`ViewportPassRegistryContext`) drives passes in sequence,
 * never nested, so no pass clobbers another's saved colour.
 */
const PREVIOUS_CLEAR_COLOR = new THREE.Color();

/**
 * Bind `target`, set the clear colour, run `draw`, and restore the render target, clear colour,
 * alpha and colour auto-clear. `draw` clears whatever it needs cleared, and writes alpha 1 into an
 * opaque target (`viewportTransfer`, the tonemap). three draws no tone curve into a target (r187
 * `WebGLPrograms.js:183`).
 */
export function renderToOffscreenTarget(
  gl: THREE.WebGLRenderer,
  options: {
    target: THREE.WebGLRenderTarget;
    /** The project clear colour, linear, which an opaque target clears to (`renderer_viewport.cpp:371`). */
    clearColor: THREE.Color;
    transparentBg: boolean;
    /** Clears no colour: a 3D render under BG_KEEP loads the colour its buffer holds. */
    keepsColor?: boolean;
    draw: () => void;
  }
): void {
  const previousTarget = gl.getRenderTarget();
  const previousAlpha = gl.getClearAlpha();
  const previousAutoClearColor = gl.autoClearColor;
  gl.getClearColor(PREVIOUS_CLEAR_COLOR);

  try {
    gl.setRenderTarget(options.target);
    gl.setClearColor(options.clearColor, options.transparentBg ? 0 : 1);
    if (options.keepsColor) gl.autoClearColor = false;
    options.draw();
  } finally {
    gl.setRenderTarget(previousTarget);
    gl.setClearColor(PREVIOUS_CLEAR_COLOR, previousAlpha);
    gl.autoClearColor = previousAutoClearColor;
  }
}

/**
 * Sets every texel of `target` to what a Godot target holds before its first render: (0, 0, 0, 0),
 * which a consumer of an opaque target samples as black (`transparentBg` false). The target takes
 * opaque black there, which draws the same.
 */
export function clearTarget(
  gl: THREE.WebGLRenderer,
  target: THREE.WebGLRenderTarget,
  transparentBg: boolean
): void {
  renderToOffscreenTarget(gl, {
    target,
    clearColor: BLACK,
    transparentBg,
    draw: () => gl.clear(true, true, true),
  });
}
