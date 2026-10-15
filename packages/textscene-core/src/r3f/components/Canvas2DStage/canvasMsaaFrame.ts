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
 * One copy pass per renderer, written only by `copyPassFor`. A pass per frame would go with each
 * resize, since `setSize` calls `dispose`, and recompile. A module-wide pass would keep every
 * renderer that drew it, through three's dispose listener. An entry goes with its renderer.
 */
const copyPasses = new WeakMap<THREE.WebGLRenderer, THREE.ShaderMaterial>();

function copyPassFor(gl: THREE.WebGLRenderer): THREE.ShaderMaterial {
  const cached = copyPasses.get(gl);
  if (cached) return cached;
  const pass = fullScreenPass('Canvas2D::msaaCopy', COPY_FRAGMENT, { frame: { value: null } });
  copyPasses.set(gl, pass);
  return pass;
}

/** Copies `frame` through `gl`'s pass, which holds no frame once the draw ends. */
function copyToTarget(
  gl: THREE.WebGLRenderer,
  frame: CanvasMsaaFrame,
  target: THREE.WebGLRenderTarget | null
): void {
  const pass = copyPassFor(gl);
  pass.uniforms.frame!.value = frame.texture;
  try {
    drawFullScreen(gl, pass, target);
  } finally {
    pass.uniforms.frame!.value = null;
  }
}

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
    try {
      gl.setRenderTarget(this);
      gl.render(scene, camera);
    } catch (error) {
      gl.setRenderTarget(previous);
      throw error;
    }
    copyToTarget(gl, this, previous);
  }
}
