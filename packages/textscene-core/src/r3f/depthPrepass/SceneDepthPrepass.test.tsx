import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { renderHook } from '@testing-library/react';
import { useSceneDepthPrepass } from './SceneDepthPrepass';

const sentinelsIn = (scene: THREE.Scene) => scene.children.filter((child) => child.name === 'DepthPrepass');

describe('useSceneDepthPrepass', () => {
  it('mounts one sentinel in the scene', () => {
    const scene = new THREE.Scene();
    renderHook(() => useSceneDepthPrepass(scene));
    expect(sentinelsIn(scene)).toHaveLength(1);
  });

  it('removes and disposes the sentinel on unmount', () => {
    const scene = new THREE.Scene();
    const { unmount } = renderHook(() => useSceneDepthPrepass(scene));
    const [sentinel] = sentinelsIn(scene) as THREE.Mesh[];
    let disposed = false;
    (sentinel!.material as THREE.Material).addEventListener('dispose', () => (disposed = true));

    unmount();

    expect(sentinelsIn(scene)).toEqual([]);
    expect(disposed).toBe(true);
  });

  it('mounts nothing without a scene (edge case)', () => {
    expect(() => renderHook(() => useSceneDepthPrepass(null))).not.toThrow();
  });
});
