import { describe, expect, it } from 'vitest';
import type * as THREE from 'three';
import { acquireFogPasses } from './fogPasses';

const renderer = () => ({}) as THREE.WebGLRenderer;

describe('acquireFogPasses', () => {
  it('shares one set of passes between the users of a renderer', () => {
    const gl = renderer();
    const first = acquireFogPasses(gl);
    const second = acquireFogPasses(gl);

    expect(second.passes).toBe(first.passes);
  });

  it('gives another renderer its own passes', () => {
    expect(acquireFogPasses(renderer()).passes).not.toBe(acquireFogPasses(renderer()).passes);
  });

  it('keeps the passes while another user holds them, counting a repeated release once', () => {
    const gl = renderer();
    const first = acquireFogPasses(gl);
    acquireFogPasses(gl);

    first.release();
    first.release();
    expect(acquireFogPasses(gl).passes).toBe(first.passes);
  });

  it('builds new passes once every user has released (edge case)', () => {
    const gl = renderer();
    const only = acquireFogPasses(gl);
    only.release();

    expect(acquireFogPasses(gl).passes).not.toBe(only.passes);
  });
});
