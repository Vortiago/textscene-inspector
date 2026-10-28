import { describe, expect, it } from 'vitest';
import type * as THREE from 'three';
import { acquireVolumetricFogPass } from './sharedVolumetricFogPass';

const renderer = () => ({}) as THREE.WebGLRenderer;

describe('acquireVolumetricFogPass', () => {
  it('shares one pass between the users of a renderer', () => {
    const gl = renderer();
    const first = acquireVolumetricFogPass(gl);
    const second = acquireVolumetricFogPass(gl);

    expect(second.pass).toBe(first.pass);
  });

  it('gives another renderer its own pass', () => {
    expect(acquireVolumetricFogPass(renderer()).pass).not.toBe(acquireVolumetricFogPass(renderer()).pass);
  });

  it('keeps the pass while another user holds them, counting a repeated release once', () => {
    const gl = renderer();
    const first = acquireVolumetricFogPass(gl);
    acquireVolumetricFogPass(gl);

    first.release();
    first.release();
    expect(acquireVolumetricFogPass(gl).pass).toBe(first.pass);
  });

  it('builds a new pass once every user has released (edge case)', () => {
    const gl = renderer();
    const only = acquireVolumetricFogPass(gl);
    only.release();

    expect(acquireVolumetricFogPass(gl).pass).not.toBe(only.pass);
  });
});
