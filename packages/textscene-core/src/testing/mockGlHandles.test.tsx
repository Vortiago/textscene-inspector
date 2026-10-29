import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { CaptureRenderer } from '../r3f/testing/CaptureRenderer';

/** test-renderer's mock context, with the handles the test setup gives it (`mockGlHandles.ts`). */
async function mockRenderer(): Promise<THREE.WebGLRenderer> {
  const captured: { current: THREE.WebGLRenderer | null } = { current: null };
  await ReactThreeTestRenderer.create(<CaptureRenderer captured={captured} />);
  return captured.current!;
}

describe('the mock WebGL context of a unit test', () => {
  it('answers a handle from each create call', async () => {
    const context = (await mockRenderer()).getContext();
    expect(context.createFramebuffer()).toBeTypeOf('object');
    expect(context.createTexture()).not.toBe(context.createTexture());
  });

  it('draws into a render target without throwing', async () => {
    const gl = await mockRenderer();
    const target = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType });
    gl.setRenderTarget(target);
    expect(() => gl.render(new THREE.Scene(), new THREE.PerspectiveCamera())).not.toThrow();
    gl.setRenderTarget(null);
    target.dispose();
  });
});
