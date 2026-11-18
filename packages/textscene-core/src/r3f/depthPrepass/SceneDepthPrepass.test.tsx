import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { renderHook } from '@testing-library/react';
import { useSceneDepthPrepass } from './SceneDepthPrepass';
import type { OpaqueSentinel } from '../../shaders/pipeline/opaqueSentinel';

const projectSettingsMock = vi.hoisted(() => ({ settings: null as Record<string, string> | null }));

vi.mock('../contexts/ProjectSettingsContext', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../contexts/ProjectSettingsContext')>()),
  useProjectSettings: () => projectSettingsMock,
}));

beforeEach(() => {
  projectSettingsMock.settings = null;
});

const sentinelsIn = (scene: THREE.Scene) =>
  scene.children.filter(
    (child) => child.name === 'DepthPrepass' || child.name === 'DepthPrepassEnd'
  ) as OpaqueSentinel[];

/** Whether each sentinel's material has been disposed, read after the test acts. */
function watchDisposal(sentinels: readonly OpaqueSentinel[]): () => boolean[] {
  const disposed = sentinels.map(() => false);
  sentinels.forEach((sentinel, index) =>
    sentinel.mesh.material.addEventListener('dispose', () => (disposed[index] = true))
  );
  return () => disposed;
}

describe('useSceneDepthPrepass', () => {
  it('mounts the first and the last sentinel in the scene', () => {
    const scene = new THREE.Scene();
    renderHook(() => useSceneDepthPrepass(scene));
    expect(sentinelsIn(scene).map(({ name }) => name)).toEqual(['DepthPrepass', 'DepthPrepassEnd']);
  });

  it('removes and disposes both sentinels on unmount', () => {
    const scene = new THREE.Scene();
    const { unmount } = renderHook(() => useSceneDepthPrepass(scene));
    const disposed = watchDisposal(sentinelsIn(scene));

    unmount();

    expect(sentinelsIn(scene)).toEqual([]);
    expect(disposed()).toEqual([true, true]);
  });

  it('mounts no sentinel when rendering/driver/depth_prepass/enable is false', () => {
    projectSettingsMock.settings = { 'rendering/driver/depth_prepass/enable': 'false' };
    const scene = new THREE.Scene();
    renderHook(() => useSceneDepthPrepass(scene));
    expect(sentinelsIn(scene)).toEqual([]);
  });

  it('mounts new sentinels when the rendering method changes', () => {
    const scene = new THREE.Scene();
    const { rerender } = renderHook(() => useSceneDepthPrepass(scene));
    const before = sentinelsIn(scene);

    projectSettingsMock.settings = { 'rendering/renderer/rendering_method': 'gl_compatibility' };
    rerender();

    expect(sentinelsIn(scene)).toHaveLength(2);
    expect(sentinelsIn(scene)).not.toContain(before[0]);
  });

  it('mounts new sentinels when the disabled vendors change', () => {
    const scene = new THREE.Scene();
    const { rerender } = renderHook(() => useSceneDepthPrepass(scene));
    const before = sentinelsIn(scene);

    projectSettingsMock.settings = { 'rendering/driver/depth_prepass/disable_for_vendors': 'Mali' };
    rerender();

    expect(sentinelsIn(scene)).not.toContain(before[0]);
  });

  it('mounts nothing without a scene (edge case)', () => {
    expect(() => renderHook(() => useSceneDepthPrepass(null))).not.toThrow();
  });
});
