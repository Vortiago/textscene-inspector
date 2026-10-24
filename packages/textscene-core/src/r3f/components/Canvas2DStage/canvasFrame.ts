/**
 * The frame a 2D canvas draws through, the root's or a sub-viewport's. The camera maps the canvas
 * top to GL row 0 (`world2DCamera.ts`), so the frame holds it upside down and copies it, rows
 * reversed, to the target bound before it. It is multisampled when `msaa_2d` is on: Godot draws
 * into a buffer at the mode's sample count (`texture_storage.cpp:3604-3613`), which a drawing buffer cannot.
 */

import * as THREE from 'three';
import { drawFullScreen, fullScreenPass } from '../../fullScreenPass';
import { takeOutputLikeDrawingBuffer } from '../../outputTarget';
import { perObject } from '../../../utils/perObject';
import { beginStep, endStep } from '../../frameProfile/frameProfile';

/**
 * Each texel to the pixel under it, from the frame's row `height - 1 - y`, so the copy neither
 * filters nor converts and the drawing buffer's row 0 is the canvas bottom again.
 */
const COPY_FRAGMENT = /* glsl */ `
uniform sampler2D frame;
void main() {
  ivec2 pixel = ivec2(gl_FragCoord.xy);
  gl_FragColor = texelFetch(frame, ivec2(pixel.x, textureSize(frame, 0).y - 1 - pixel.y), 0);
}`;

/**
 * A pass per renderer, not per frame: `setSize` calls `dispose`, so a frame's own pass would
 * recompile on each resize.
 */
const copyPassFor = perObject<THREE.WebGLRenderer, THREE.ShaderMaterial>(() =>
  fullScreenPass('Canvas2D::frameCopy', COPY_FRAGMENT, { frame: { value: null } })
);

/** Copies `frame` through `gl`'s pass, which holds no frame once the draw ends. */
function copyToTarget(
  gl: THREE.WebGLRenderer,
  frame: CanvasFrame,
  target: THREE.WebGLRenderTarget | null
): void {
  const pass = copyPassFor(gl);
  pass.uniforms.frame!.value = frame.texture;
  beginStep(gl, 'Canvas copy');
  try {
    drawFullScreen(gl, pass, target);
  } finally {
    pass.uniforms.frame!.value = null;
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

  /** Draws `scene` into the frame and copies the result, rows reversed, to the target bound before. */
  render(gl: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera): void {
    const previous = gl.getRenderTarget();
    this.sizeLike(gl, previous);
    try {
      gl.setRenderTarget(this);
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
