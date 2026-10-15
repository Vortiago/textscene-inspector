import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { releaseTextures, setUniforms, skyPass } from './skyPass';

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
