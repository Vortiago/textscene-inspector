import { describe, expect, it } from 'vitest';
import { skyPass } from './skyPass';

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
