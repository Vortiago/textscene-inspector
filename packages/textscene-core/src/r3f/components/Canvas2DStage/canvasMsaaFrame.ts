/**
 * The 2D canvas's multisampled frame. Godot draws a root viewport whose `msaa_2d` is on into a
 * multisampled buffer at the mode's sample count (`texture_storage.cpp:3604-3613`). A drawing buffer
 * cannot multisample at a chosen count, so the world draws into the frame, a multisampled target
 * that three resolves, and the frame copies itself to the drawing buffer unchanged.
 */

import * as THREE from 'three';
import { drawFullScreen, fullScreenPass } from '../../fullScreenPass';
import { takeOutputLikeDrawingBuffer } from '../../outputTarget';

/** Each texel to the pixel under it, so the copy neither filters nor converts. */
const COPY_FRAGMENT = /* glsl */ `
uniform sampler2D frame;
void main() {
  gl_FragColor = texelFetch(frame, ivec2(gl_FragCoord.xy), 0);
}`;

/**
 * One copy pass for every frame, which each frame points at its own texture before it draws. A
 * pass per frame would go with the frame's `dispose`, which `setSize` calls on every resize, and
 * recompile its shader.
 */
const copyPass = fullScreenPass('Canvas2D::msaaCopy', COPY_FRAGMENT, { frame: { value: null } });

/**
 * RGBA8 storage under an sRGB tag. Taking output like the drawing buffer, three encodes each
 * fragment to the tag's space (`WebGLPrograms.js:213`), so the frame holds what the drawing buffer
 * would hold and items blend in the same space. The default sRGB format, SRGB8_ALPHA8, would blend
 * in linear.
 */
export class CanvasMsaaFrame extends THREE.WebGLRenderTarget {
  private readonly drawingBuffer = new THREE.Vector2();

  constructor() {
    super(1, 1, { depthBuffer: true, stencilBuffer: false });
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.internalFormat = 'RGBA8';
    this.texture.minFilter = THREE.NearestFilter;
    this.texture.magFilter = THREE.NearestFilter;
    this.texture.generateMipmaps = false;
    this.texture.name = 'Canvas2D::msaaFrame';
    takeOutputLikeDrawingBuffer(this);
  }

  /** Draws `scene` into the frame and copies the result to the target bound before. */
  render(gl: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera): void {
    gl.getDrawingBufferSize(this.drawingBuffer);
    if (this.width !== this.drawingBuffer.x || this.height !== this.drawingBuffer.y) {
      this.setSize(this.drawingBuffer.x, this.drawingBuffer.y);
    }
    const previous = gl.getRenderTarget();
    gl.setRenderTarget(this);
    gl.render(scene, camera);
    copyPass.uniforms.frame!.value = this.texture;
    drawFullScreen(gl, copyPass, previous);
  }
}
