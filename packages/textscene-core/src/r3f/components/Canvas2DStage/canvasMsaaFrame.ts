/**
 * The 2D canvas's multisampled frame. Godot draws a root viewport whose `msaa_2d` is on into a
 * multisampled buffer at the mode's sample count (`texture_storage.cpp:3604-3613`). A drawing buffer
 * cannot multisample at a chosen count, so the world draws into a multisampled target, which three
 * resolves, and the frame copies to the drawing buffer unchanged.
 */

import * as THREE from 'three';
import { drawFullScreen, fullScreenPass } from '../../fullScreenPass';
import { takeOutputLikeDrawingBuffer } from '../../outputTarget';

export interface CanvasMsaaFrame {
  /** Draws `scene` through the target and copies the result to the target bound before. */
  render(gl: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera): void;
  dispose(): void;
}

/** Each texel to the pixel under it, so the copy neither filters nor converts. */
const COPY_FRAGMENT = /* glsl */ `
uniform sampler2D frame;
void main() {
  gl_FragColor = texelFetch(frame, ivec2(gl_FragCoord.xy), 0);
}`;

export function createCanvasMsaaFrame(samples: number): CanvasMsaaFrame {
  const target = createFrameTarget(samples);
  const copy = fullScreenPass('Canvas2D::msaaCopy', COPY_FRAGMENT, { frame: { value: target.texture } });
  const drawingBuffer = new THREE.Vector2();

  return {
    render(gl, scene, camera) {
      gl.getDrawingBufferSize(drawingBuffer);
      if (target.width !== drawingBuffer.x || target.height !== drawingBuffer.y) {
        target.setSize(drawingBuffer.x, drawingBuffer.y);
      }
      const previous = gl.getRenderTarget();
      gl.setRenderTarget(target);
      gl.render(scene, camera);
      drawFullScreen(gl, copy, previous);
    },
    dispose() {
      target.dispose();
      copy.dispose();
    },
  };
}

/**
 * RGBA8 storage under an sRGB tag. Taking output like the drawing buffer, three encodes each
 * fragment to the tag's space (`WebGLPrograms.js:213`), so the target holds what the drawing buffer
 * would hold and items blend in the same space. The default sRGB format, SRGB8_ALPHA8, would blend
 * in linear.
 */
function createFrameTarget(samples: number): THREE.WebGLRenderTarget {
  const target = new THREE.WebGLRenderTarget(1, 1, { samples, depthBuffer: true, stencilBuffer: false });
  target.texture.colorSpace = THREE.SRGBColorSpace;
  target.texture.internalFormat = 'RGBA8';
  target.texture.minFilter = THREE.NearestFilter;
  target.texture.magFilter = THREE.NearestFilter;
  target.texture.generateMipmaps = false;
  target.texture.name = 'Canvas2D::msaaFrame';
  takeOutputLikeDrawingBuffer(target);
  return target;
}
