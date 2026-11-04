import type * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { FittedBuffers } from './fittedBuffers';

const renderer = {} as THREE.WebGLRenderer;

interface Shape {
  width: number;
  project: { quality: number };
}

function fittedBuffers() {
  const build = vi.fn((_renderer: THREE.WebGLRenderer, shape: Shape) => ({ shape, dispose: vi.fn() }));
  const leave = vi.fn();
  return { fitted: new FittedBuffers(build, leave), build, leave };
}

describe('FittedBuffers', () => {
  it('keeps its buffers for a shape of the same content', () => {
    const { fitted, build } = fittedBuffers();
    const first = fitted.fit(renderer, { width: 4, project: { quality: 2 } });

    expect(fitted.fit(renderer, { width: 4, project: { quality: 2 } })).toBe(first);
    expect(build).toHaveBeenCalledTimes(1);
  });

  it('leaves and frees its buffers before it builds them at a new shape', () => {
    const { fitted, leave } = fittedBuffers();
    const first = fitted.fit(renderer, { width: 4, project: { quality: 2 } });

    const second = fitted.fit(renderer, { width: 4, project: { quality: 3 } });

    expect(second).not.toBe(first);
    expect(leave).toHaveBeenCalledWith(renderer, first);
    expect(first.dispose).toHaveBeenCalledTimes(1);
  });

  it('holds none after a release, and a second release changes nothing (edge case)', () => {
    const { fitted, leave } = fittedBuffers();
    fitted.fit(renderer, { width: 4, project: { quality: 2 } });

    fitted.release(renderer);
    fitted.release(renderer);

    expect(fitted.current).toBeNull();
    expect(leave).toHaveBeenCalledTimes(1);
  });
});
