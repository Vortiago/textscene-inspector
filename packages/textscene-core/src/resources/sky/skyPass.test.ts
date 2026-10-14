import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { draw, releaseTextures, setUniforms, skyPass } from './skyPass';
import { testRenderer } from '../../testing/recordingWebGL';

const FRAGMENT = 'void main() { gl_FragColor = vec4(1.0); }';

describe('skyPass', () => {
  it('declares each named uniform, empty until the bake sets it', () => {
    const pass = skyPass(FRAGMENT, ['source', 'size']);

    expect(Object.keys(pass.uniforms)).toEqual(['source', 'size']);
    expect(pass.uniforms.size!.value).toBeNull();
  });

  it('neither reads nor writes depth, as it draws over the whole target', () => {
    const pass = skyPass(FRAGMENT, []);

    expect([pass.depthTest, pass.depthWrite]).toEqual([false, false]);
  });

  it('declares no uniform when it reads none (edge case)', () => {
    expect(skyPass(FRAGMENT, []).uniforms).toEqual({});
  });
});

describe('setUniforms', () => {
  it('sets each named uniform', () => {
    const pass = skyPass(FRAGMENT, ['size', 'borderSize']);

    setUniforms(pass, { size: 640, borderSize: 0.8 });

    expect([pass.uniforms.size!.value, pass.uniforms.borderSize!.value]).toEqual([640, 0.8]);
  });

  it('refuses a name the pass does not declare (error case)', () => {
    const pass = skyPass(FRAGMENT, ['size']);

    expect(() => setUniforms(pass, { sise: 640 })).toThrow('expected a uniform of the pass, got sise');
  });

  it('leaves the uniforms it does not name as they are (edge case)', () => {
    const pass = skyPass(FRAGMENT, ['size', 'borderSize']);
    setUniforms(pass, { size: 640, borderSize: 0.8 });

    setUniforms(pass, { size: 320 });

    expect(pass.uniforms.borderSize!.value).toBe(0.8);
  });
});

describe('releaseTextures', () => {
  it('lets go of each texture the pass reads', () => {
    const pass = skyPass(FRAGMENT, ['source']);
    setUniforms(pass, { source: new THREE.Texture() });

    releaseTextures(pass);

    expect(pass.uniforms.source!.value).toBeNull();
  });

  it('keeps the uniforms that hold no texture', () => {
    const pass = skyPass(FRAGMENT, ['source', 'size']);
    setUniforms(pass, { source: new THREE.Texture(), size: 640 });

    releaseTextures(pass);

    expect(pass.uniforms.size!.value).toBe(640);
  });

  it('releases a render target texture too, as the chain is one (edge case)', () => {
    const pass = skyPass(FRAGMENT, ['chain']);
    setUniforms(pass, { chain: new THREE.WebGLRenderTarget(4, 4).texture });

    releaseTextures(pass);

    expect(pass.uniforms.chain!.value).toBeNull();
  });
});

describe('draw', () => {
  it('draws the pass into the target', async () => {
    const { renderer } = await testRenderer();
    const pass = skyPass(FRAGMENT, []);
    const target = new THREE.WebGLRenderTarget(4, 4);
    const rendered = vi.spyOn(renderer, 'render');

    draw(renderer, pass, target);

    const [scene] = rendered.mock.calls[0]!;
    expect([renderer.getRenderTarget(), (scene.children[0] as THREE.Mesh).material]).toEqual([target, pass]);
  });

  it('draws into the cube face and the mip it names (edge case)', async () => {
    const { renderer } = await testRenderer();
    const target = new THREE.WebGLCubeRenderTarget(4);
    target.texture.mipmaps = [{}, {}, {}] as unknown as THREE.Texture['mipmaps'];

    draw(renderer, skyPass(FRAGMENT, []), target, 3, 1);

    expect([renderer.getActiveCubeFace(), renderer.getActiveMipmapLevel()]).toEqual([3, 1]);
  });

  it('draws the pass it is given, never the one drawn before (error case)', async () => {
    const { renderer } = await testRenderer();
    const target = new THREE.WebGLRenderTarget(4, 4);
    const second = skyPass(FRAGMENT, []);
    draw(renderer, skyPass(FRAGMENT, []), target);
    const rendered = vi.spyOn(renderer, 'render');

    draw(renderer, second, target);

    const [scene] = rendered.mock.calls[0]!;
    expect((scene.children[0] as THREE.Mesh).material).toBe(second);
  });
});
