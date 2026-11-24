import { describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useSceneRead } from './sceneRead';
import { openScene } from '../../../scene/openScene';
import type { NodeHandle } from '../../../scene/nodeHandle';
import '../../sceneLiveTree.js';

const sceneOf = (rootName: string) => `[gd_scene format=3]\n\n[node name="${rootName}" type="Node3D"]\n`;

const open = () => openScene({ source: sceneOf('Main'), provider: { loadResource: async () => null } });

describe('useSceneRead', () => {
  it('keeps the last answer through an edit until the new answer lands', async () => {
    let release = (_name: string) => {};
    const read = async (root: NodeHandle) => {
      if (root.name === 'Main') return root.name;
      return new Promise<string>((resolve) => (release = resolve));
    };
    const scene = open();
    const { result } = renderHook(() => useSceneRead(scene, read));
    await waitFor(() => expect(result.current).toBe('Main'));

    act(() => scene.setSource(sceneOf('Edited')));
    expect(result.current).toBe('Main');

    await act(async () => release('Edited'));
    expect(result.current).toBe('Edited');
  });

  it('reads again on a new mount after a read that failed', async () => {
    const read = vi
      .fn<(root: NodeHandle) => Promise<string>>()
      .mockRejectedValueOnce(new Error('expected a class, got none'))
      .mockResolvedValue('Main');
    const scene = open();
    const first = renderHook(() => useSceneRead(scene, read));
    await waitFor(() => expect(read).toHaveBeenCalledTimes(1));
    first.unmount();

    const { result } = renderHook(() => useSceneRead(scene, read));
    await waitFor(() => expect(result.current).toBe('Main'));
  });

  it('reads the tree once for two readers of one text', async () => {
    const read = vi.fn(async (root: NodeHandle) => root.name);
    const scene = open();
    renderHook(() => [useSceneRead(scene, read), useSceneRead(scene, read)]);
    await waitFor(() => expect(read).toHaveBeenCalled());
    expect(read).toHaveBeenCalledTimes(1);
  });
});
