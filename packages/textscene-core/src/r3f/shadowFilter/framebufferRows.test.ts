import { afterEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import {
  FRAMEBUFFER_HEIGHT_UNIFORM,
  framebufferHeight,
  installFramebufferHeightUniform,
  writeFramebufferHeight,
} from './framebufferRows';

afterEach(() => {
  for (const shader of Object.values(THREE.ShaderLib)) delete shader.uniforms[FRAMEBUFFER_HEIGHT_UNIFORM];
  delete (THREE.UniformsLib.lights as Record<string, THREE.IUniform>)[FRAMEBUFFER_HEIGHT_UNIFORM];
});

/** The part of a renderer the height reads. */
function rendererDrawingInto(
  target: THREE.WebGLRenderTarget | null,
  canvasHeight = 756
): THREE.WebGLRenderer {
  return {
    getRenderTarget: () => target,
    getDrawingBufferSize: (size: THREE.Vector2) => size.set(955, canvasHeight),
  } as unknown as THREE.WebGLRenderer;
}

describe('writeFramebufferHeight', () => {
  it('records the canvas’s drawing buffer for a render to the canvas', () => {
    writeFramebufferHeight(rendererDrawingInto(null));
    expect(framebufferHeight[0]).toBe(756);
  });

  it('records a render target’s own height for a render into it', () => {
    writeFramebufferHeight(rendererDrawingInto(new THREE.WebGLRenderTarget(64, 32)));
    expect(framebufferHeight[0]).toBe(32);
  });

  it('shares one buffer through a material’s uniform clone (edge case)', () => {
    const cloned = THREE.UniformsUtils.clone({ height: { value: framebufferHeight } });
    expect(cloned.height!.value).toBe(framebufferHeight);
  });

  it('writes the buffer an earlier evaluation gave the lit materials (error case)', async () => {
    THREE.ShaderLib.standard.uniforms[FRAMEBUFFER_HEIGHT_UNIFORM] = { value: framebufferHeight };
    vi.resetModules();
    const reloaded = await import('./framebufferRows');
    expect(reloaded.framebufferHeight).toBe(framebufferHeight);
  });
});

describe('installFramebufferHeightUniform', () => {
  it('gives every lit built-in material and three’s light uniforms the one buffer', () => {
    installFramebufferHeightUniform();
    for (const name of ['lambert', 'phong', 'standard', 'physical', 'toon', 'shadow']) {
      expect(THREE.ShaderLib[name]!.uniforms[FRAMEBUFFER_HEIGHT_UNIFORM]!.value).toBe(framebufferHeight);
    }
    const merged = THREE.UniformsUtils.merge([THREE.UniformsLib.lights]);
    expect(merged[FRAMEBUFFER_HEIGHT_UNIFORM]!.value).toBe(framebufferHeight);
  });

  it('leaves an unlit material alone (edge case)', () => {
    installFramebufferHeightUniform();
    expect(THREE.ShaderLib.basic.uniforms[FRAMEBUFFER_HEIGHT_UNIFORM]).toBeUndefined();
  });
});
