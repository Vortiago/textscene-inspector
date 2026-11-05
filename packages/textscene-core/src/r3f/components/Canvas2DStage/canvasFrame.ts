/**
 * The frame a 2D canvas draws through, the root's or a sub-viewport's. The camera maps the canvas
 * top to GL row 0 (`world2DCamera.ts`), so the frame holds it upside down and copies it, rows
 * reversed, to the target bound before it. It is multisampled when `msaa_2d` is on: Godot draws
 * into a buffer at the mode's sample count (`texture_storage.cpp:3604-3613`), which a drawing buffer cannot.
 */

import * as THREE from 'three';
import { copyTexels, reversedTexelRows, type TexelPlacement, type TexelTransfer } from '../../texelCopy';
import { takeOutputLikeDrawingBuffer } from '../../outputTarget';
import { beginStep, endStep } from '../../frameProfile/frameProfile';
import { drawOffscreen } from '../../offscreen';
import type { CanvasColorSpace } from '../../canvasColorSpace';

/**
 * Copies `frame` to the target, each texel to the pixel under it from the frame's row
 * `height - 1 - y`, so the copy neither filters nor converts and the drawing buffer's row 0 is the
 * canvas bottom again.
 */
function copyToTarget(
  gl: THREE.WebGLRenderer,
  frame: CanvasFrame,
  target: THREE.WebGLRenderTarget | null,
  transfer: TexelTransfer
): void {
  beginStep(gl, 'Canvas copy');
  try {
    copyTexels(gl, frame.texture, target, frame.rowsReversed(), transfer);
  } finally {
    endStep(gl, 'Canvas copy');
  }
}

/**
 * In an sRGB canvas, RGBA8 storage under an sRGB tag. Taking output like the drawing buffer, three
 * encodes each fragment to the tag's space (r187 `WebGLPrograms.js:217`), so the frame holds what the
 * drawing buffer would hold and items blend in the same space. The default sRGB format,
 * SRGB8_ALPHA8, would blend in linear. In a linear canvas, RGBA16F under a linear tag, so three
 * writes each fragment as it is and items blend linear values, those above 1 included.
 */
class CanvasFrame extends THREE.WebGLRenderTarget {
  private readonly outputSize = new THREE.Vector2();
  private placement: TexelPlacement = reversedTexelRows(1, 1);

  constructor(space: CanvasColorSpace) {
    super(1, 1, {
      depthBuffer: true,
      stencilBuffer: false,
      type: space.isLinear ? THREE.HalfFloatType : THREE.UnsignedByteType,
    });
    this.texture.colorSpace = space.isLinear ? THREE.LinearSRGBColorSpace : THREE.SRGBColorSpace;
    this.texture.internalFormat = space.isLinear ? 'RGBA16F' : 'RGBA8';
    this.texture.minFilter = THREE.NearestFilter;
    this.texture.magFilter = THREE.NearestFilter;
    this.texture.generateMipmaps = false;
    this.texture.name = 'Canvas2D::frame';
    takeOutputLikeDrawingBuffer(this);
  }

  /**
   * Draws `scene` into the frame and copies the result, rows reversed, to the target bound before.
   * The frame clears itself where the render will not: a render clears only while the renderer's
   * `autoClear` is on, which a caller may turn off. A target of SRGB8_ALPHA8 storage takes the
   * `decode` transfer, so its hardware encode writes the frame's bytes back unchanged.
   */
  render(
    gl: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.Camera,
    transfer: TexelTransfer = 'none'
  ): void {
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
    copyToTarget(gl, this, previous, transfer);
  }

  /** Draws `scene` as a render that clears, or over the target's bytes as one that does not. */
  draw(
    gl: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.Camera,
    clears: boolean,
    transfer: TexelTransfer = 'none'
  ): void {
    if (clears) this.render(gl, scene, camera, transfer);
    else this.renderOverTarget(gl, scene, camera, transfer);
  }

  /**
   * Draws `scene` over the bytes the bound target holds, as a canvas draws over a target that is
   * never cleared (`renderer_canvas_render_rd.cpp:2276-2283`). The frame takes those texels first,
   * and its depth is the only thing the render clears. The target holds the frame's space.
   */
  private renderOverTarget(
    gl: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.Camera,
    transfer: TexelTransfer
  ): void {
    const target = gl.getRenderTarget();
    this.sizeLike(gl, target);
    if (target) drawOffscreen(gl, () => copyTexels(gl, target.texture, this, this.rowsReversed()));
    const clearsColor = gl.autoClearColor;
    gl.autoClearColor = false;
    try {
      this.render(gl, scene, camera, transfer);
    } finally {
      gl.autoClearColor = clearsColor;
    }
  }

  /** The copy neither scales nor filters, so the frame is as large as the output it copies to. */
  private sizeLike(gl: THREE.WebGLRenderer, output: THREE.WebGLRenderTarget | null): void {
    if (output) this.outputSize.set(output.width, output.height);
    else gl.getDrawingBufferSize(this.outputSize);
    if (this.width !== this.outputSize.x || this.height !== this.outputSize.y) {
      this.setSize(this.outputSize.x, this.outputSize.y);
    }
  }

  /** Each row of the frame from its mirror row, made again only when the frame changes size. */
  rowsReversed(): TexelPlacement {
    const [, , width, height] = this.placement.bounds;
    if (width !== this.width || height !== this.height)
      this.placement = reversedTexelRows(this.width, this.height);
    return this.placement;
  }
}

/** The frame of a canvas drawn in `space`, the factory `useMultisampledTarget` takes. */
export const createCanvasFrame = (space: CanvasColorSpace) => new CanvasFrame(space);
