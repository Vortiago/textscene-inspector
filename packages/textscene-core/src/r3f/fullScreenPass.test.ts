import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { drawFullScreen, FULL_SCREEN_VERTEX, fullScreenPass } from './fullScreenPass';
import { testRenderer } from '../testing/recordingWebGL';

const FRAGMENT = 'void main() { gl_FragColor = vec4(1.0); }';

describe('fullScreenPass', () => {
  it('builds a pass that overwrites its target with the fragment shader', () => {
    const pass = fullScreenPass('Copy', FRAGMENT, { source: { value: null } });

    expect([pass.name, pass.vertexShader, pass.fragmentShader, pass.blending]).toEqual([
      'Copy',
      FULL_SCREEN_VERTEX,
      FRAGMENT,
      THREE.NoBlending,
    ]);
  });

  it('neither reads nor writes depth, nor tone maps', () => {
    const pass = fullScreenPass('Copy', FRAGMENT, {});

    expect([pass.depthTest, pass.depthWrite, pass.toneMapped]).toEqual([false, false, false]);
  });

  it('hands the fragment shader the target uv as vUv', () => {
    expect(fullScreenPass('Copy', FRAGMENT, {}).vertexShader).toContain('vUv = position.xy + 0.5;');
  });

  it('keeps the uniform objects it is given, so a caller can hold one (edge case)', () => {
    const source = { value: null };

    expect(fullScreenPass('Copy', FRAGMENT, { source }).uniforms['source']).toBe(source);
  });
});

describe('drawFullScreen', () => {
  it('draws the pass into the target', async () => {
    const { renderer } = await testRenderer();
    const pass = fullScreenPass('Copy', FRAGMENT, {});
    const target = new THREE.WebGLRenderTarget(4, 4);
    const rendered = vi.spyOn(renderer, 'render');

    drawFullScreen(renderer, pass, target);

    const [quad] = rendered.mock.calls[0]!;
    expect([renderer.getRenderTarget(), (quad as THREE.Mesh).material]).toEqual([target, pass]);
  });

  it('draws into the layer and the mip it names', async () => {
    const { renderer } = await testRenderer();
    const target = new THREE.WebGLCubeRenderTarget(4);
    target.texture.mipmaps = [{}, {}, {}] as unknown as THREE.Texture['mipmaps'];

    drawFullScreen(renderer, fullScreenPass('Copy', FRAGMENT, {}), target, 3, 1);

    expect([renderer.getActiveCubeFace(), renderer.getActiveMipmapLevel()]).toEqual([3, 1]);
  });

  it('draws each pass with its own material when passes alternate (edge case)', async () => {
    const { renderer } = await testRenderer();
    const first = fullScreenPass('First', FRAGMENT, {});
    const second = fullScreenPass('Second', FRAGMENT, {});
    const target = new THREE.WebGLRenderTarget(4, 4);
    const drawn: THREE.Material[] = [];
    vi.spyOn(renderer, 'render').mockImplementation((quad) => {
      drawn.push((quad as THREE.Mesh).material as THREE.Material);
    });

    drawFullScreen(renderer, first, target);
    drawFullScreen(renderer, second, target);

    expect(drawn).toEqual([first, second]);
  });
});
