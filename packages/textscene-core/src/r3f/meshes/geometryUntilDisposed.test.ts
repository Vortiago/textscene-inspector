import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { geometryUntilDisposed } from './geometryUntilDisposed';

describe('geometryUntilDisposed', () => {
  it('builds at the first call and hands out the same geometry after it', () => {
    const build = vi.fn(() => new THREE.BufferGeometry());
    const geometry = geometryUntilDisposed(build);

    expect(build).not.toHaveBeenCalled();
    expect(geometry()).toBe(geometry());
    expect(build).toHaveBeenCalledTimes(1);
  });

  it('builds a new geometry once the last holder disposes the one it handed out', () => {
    const geometry = geometryUntilDisposed(() => new THREE.BufferGeometry());
    const first = geometry();
    first.dispose();

    expect(geometry()).not.toBe(first);
  });
});
