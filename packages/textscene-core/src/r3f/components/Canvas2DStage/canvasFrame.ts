/**
 * The frame a 2D canvas draws through, the root's or a sub-viewport's. The camera maps the canvas
 * top to GL row 0 (`world2DCamera.ts`), so the frame holds it upside down and copies it, rows
 * reversed, to the target bound before it. It is multisampled when `msaa_2d` is on: Godot draws
 * into a buffer at the mode's sample count (`texture_storage.cpp:3604-3613`), which a drawing buffer cannot.
 */

import * as THREE from 'three';
import { copyTexels } from '../../texelCopy';
import { takeOutputLikeDrawingBuffer } from '../../outputTarget';
import { beginStep, endStep } from '../../frameProfile/frameProfile';

/**
 * Copies `frame` to the target, each texel to the pixel under it from the frame's row
 * `height - 1 - y`, so the copy neither filters nor converts and the drawing buffer's row 0 is the
 * canvas bottom again.
 */
function copyToTarget(
  gl: THREE.WebGLRenderer,
  frame: CanvasFrame,
  target: THREE.WebGLRenderTarget | null
): void {
  beginStep(gl, 'Canvas copy');
  try {
    copyTexels(gl, frame.texture, target, {
      offsetX: 0,
      offsetY: frame.height - 1,
      rowStep: -1,
      bounds: [0, 0, frame.width, frame.height],
    });
  } finally {
    endStep(gl, 'Canvas copy');
  }
}

/**
 * RGBA8 storage under an sRGB tag. Taking output like the drawing buffer, three encodes each
 * fragment to the tag's space (`WebGLPrograms.js:213`), so the frame holds what the drawing buffer
 * would hold and items blend in the same space. The default sRGB format, SRGB8_ALPHA8, would blend
 * in linear.
 */
class CanvasFrame extends THREE.WebGLRenderTarget {
  private readonly outputSize = new THREE.Vector2();

  constructor() {
    super(1, 1, { depthBuffer: true, stencilBuffer: false });
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.internalFormat = 'RGBA8';
    this.texture.minFilter = THREE.NearestFilter;
    this.texture.magFilter = THREE.NearestFilter;
    this.texture.generateMipmaps = false;
    this.texture.name = 'Canvas2D::frame';
    takeOutputLikeDrawingBuffer(this);
  }

  /**
   * Draws `scene` into the frame and copies the result, rows reversed, to the target bound before.
   * The frame clears itself where the render will not: a render clears only while the renderer's
   * `autoClear` is on, which the tone-map composer turns off.
   */
  render(gl: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera): void {
    const previous = gl.getRenderTarget();
    this.sizeLike(gl, previous);
    try {
      gl.setRenderTarget(this);
      if (!gl.autoClear) gl.clear(true, true, true);
      gl.render(scene, camera);
    } catch (error) {
      gl.setRenderTarget(previous);
      throw error;
    }
    copyToTarget(gl, this, previous);
  }

  /** The copy neither scales nor filters, so the frame is as large as the output it copies to. */
  private sizeLike(gl: THREE.WebGLRenderer, output: THREE.WebGLRenderTarget | null): void {
    if (output) this.outputSize.set(output.width, output.height);
    else gl.getDrawingBufferSize(this.outputSize);
    if (this.width !== this.outputSize.x || this.height !== this.outputSize.y) {
      this.setSize(this.outputSize.x, this.outputSize.y);
    }
  }
}

/** The factory `useMultisampledTarget` takes for a 2D canvas frame. */
export const createCanvasFrame = () => new CanvasFrame();
