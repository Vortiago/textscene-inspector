import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import {
  drawFullScreen,
  FULL_SCREEN_VERTEX,
  fullScreenDepthPass,
  fullScreenPass,
  namedUniformPass,
  releaseTextures,
  setUniforms,
} from './fullScreenPass';
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

describe('fullScreenDepthPass', () => {
  it('writes the depth its fragment shader gives every texel, whatever the target holds', () => {
    const pass = fullScreenDepthPass('Copy', FRAGMENT, {});

    expect([pass.depthTest, pass.depthFunc, pass.depthWrite]).toEqual([true, THREE.AlwaysDepth, true]);
  });

  it('overwrites the colour as a full-screen pass does', () => {
    const pass = fullScreenDepthPass('Copy', FRAGMENT, {});

    expect([pass.vertexShader, pass.blending, pass.toneMapped]).toEqual([
      FULL_SCREEN_VERTEX,
      THREE.NoBlending,
      false,
    ]);
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

  it('draws each renderer on a quad of its own (edge case)', async () => {
    const drawnQuads = await Promise.all([quadDrawnBy(), quadDrawnBy()]);

    expect(drawnQuads[0]).not.toBe(drawnQuads[1]);
    expect(drawnQuads[0]!.geometry).not.toBe(drawnQuads[1]!.geometry);
  });
});

/**
 * The quad a new renderer draws a pass on. three leaves a dispose listener that closes over the
 * renderer on each drawn geometry and material (`WebGLGeometries.js:55`, `WebGLRenderer.js:2216`),
 * so a quad two renderers share would keep both alive.
 */
async function quadDrawnBy(): Promise<THREE.Mesh> {
  const { renderer } = await testRenderer();
  const rendered = vi.spyOn(renderer, 'render');
  drawFullScreen(renderer, fullScreenPass('Copy', FRAGMENT, {}), null);
  return rendered.mock.calls[0]![0] as THREE.Mesh;
}

describe('namedUniformPass', () => {
  it('declares each named uniform, empty until a draw sets it', () => {
    const pass = namedUniformPass('Pass', FRAGMENT, ['source', 'size']);

    expect(Object.keys(pass.uniforms)).toEqual(['source', 'size']);
    expect(pass.uniforms.size!.value).toBeNull();
  });
});

describe('setUniforms', () => {
  it('sets each named uniform', () => {
    const pass = namedUniformPass('Pass', FRAGMENT, ['size', 'borderSize']);

    setUniforms(pass, { size: 640, borderSize: 0.8 });

    expect([pass.uniforms.size!.value, pass.uniforms.borderSize!.value]).toEqual([640, 0.8]);
  });

  it('refuses a name the pass does not declare (error case)', () => {
    const pass = namedUniformPass('Pass', FRAGMENT, ['size']);

    expect(() => setUniforms(pass, { sise: 640 })).toThrow('expected a uniform of the pass, got sise');
  });

  it('leaves the uniforms it does not name as they are (edge case)', () => {
    const pass = namedUniformPass('Pass', FRAGMENT, ['size', 'borderSize']);
    setUniforms(pass, { size: 640, borderSize: 0.8 });

    setUniforms(pass, { size: 320 });

    expect(pass.uniforms.borderSize!.value).toBe(0.8);
  });
});

describe('releaseTextures', () => {
  it('lets go of each texture the pass reads', () => {
    const pass = namedUniformPass('Pass', FRAGMENT, ['source']);
    setUniforms(pass, { source: new THREE.Texture() });

    releaseTextures(pass);

    expect(pass.uniforms.source!.value).toBeNull();
  });

  it('keeps the uniforms that hold no texture', () => {
    const pass = namedUniformPass('Pass', FRAGMENT, ['source', 'size']);
    setUniforms(pass, { source: new THREE.Texture(), size: 640 });

    releaseTextures(pass);

    expect(pass.uniforms.size!.value).toBe(640);
  });

  it('releases a render target texture too, as the chain is one (edge case)', () => {
    const pass = namedUniformPass('Pass', FRAGMENT, ['chain']);
    setUniforms(pass, { chain: new THREE.WebGLRenderTarget(4, 4).texture });

    releaseTextures(pass);

    expect(pass.uniforms.chain!.value).toBeNull();
  });
});
