import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { acquireVolumetricFogPass } from './sharedVolumetricFogPass';

const renderer = () => ({}) as THREE.WebGLRenderer;
const SCENE = new THREE.Scene();

describe('acquireVolumetricFogPass', () => {
  it('shares one pass between the users of a renderer', () => {
    const gl = renderer();
    const first = acquireVolumetricFogPass(gl, SCENE);
    const second = acquireVolumetricFogPass(gl, SCENE);

    expect(second.pass).toBe(first.pass);
  });

  it('gives another renderer its own pass', () => {
    expect(acquireVolumetricFogPass(renderer(), SCENE).pass).not.toBe(
      acquireVolumetricFogPass(renderer(), SCENE).pass
    );
  });

  it('keeps the pass while another user holds them, counting a repeated release once', () => {
    const gl = renderer();
    const first = acquireVolumetricFogPass(gl, SCENE);
    acquireVolumetricFogPass(gl, SCENE);

    first.release();
    first.release();
    expect(acquireVolumetricFogPass(gl, SCENE).pass).toBe(first.pass);
  });

  it('builds a new pass once every user has released (edge case)', () => {
    const gl = renderer();
    const only = acquireVolumetricFogPass(gl, SCENE);
    only.release();

    expect(acquireVolumetricFogPass(gl, SCENE).pass).not.toBe(only.pass);
  });

  it("forgets a scene's view volumes only once its last user releases", () => {
    const gl = renderer();
    const first = acquireVolumetricFogPass(gl, SCENE);
    const second = acquireVolumetricFogPass(gl, SCENE);
    acquireVolumetricFogPass(gl, new THREE.Scene());
    const forget = vi.spyOn(first.pass, 'forget');

    first.release();
    expect(forget).not.toHaveBeenCalled();
    second.release();
    expect(forget).toHaveBeenCalledExactlyOnceWith(SCENE);
  });
});
