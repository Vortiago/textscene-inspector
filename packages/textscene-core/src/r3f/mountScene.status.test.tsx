import { act } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mountScene, type ViewOptions } from './mountScene';
import { openScene } from '../scene/openScene';
import type { ResourceProvider } from '../resources/ResourceProvider';

// No WebGL here: the stub draws in software and holds an undrawn mesh typed by its stage.
vi.mock('@react-three/fiber', async (importOriginal) => {
  const { useViewStatusStore } = await import('./viewStatus/ViewStatusContext');
  const { useEffect } = await import('react');
  return {
    ...(await importOriginal<typeof import('@react-three/fiber')>()),
    Canvas: function SoftwareCanvas({ camera }: { camera?: unknown }) {
      const store = useViewStatusStore();
      useEffect(() => store?.softwareRenderingFound(), [store]);
      useEffect(
        () => store?.reportUndrawn('Main', { meshType: camera ? 'EditorMesh' : 'GameMesh' }),
        [store, camera]
      );
      return <canvas />;
    },
  };
});

const NO_FILES: ResourceProvider = { loadResource: async () => null };
const SCENE = '[gd_scene format=3]\n\n[node name="Main" type="Node3D"]\n';

function sceneView(options: ViewOptions = {}) {
  const host = document.createElement('div');
  document.body.append(host);
  return mountScene(host, openScene({ source: SCENE, provider: NO_FILES }), { mode: '3D', ...options });
}

afterEach(() => {
  document.body.replaceChildren();
});

describe('the status of a mounted view', () => {
  it('reports what the view found, with no frame drawn yet', async () => {
    const view = await act(async () => sceneView());

    expect(view.status()).toEqual({
      settled: null,
      pending: { textures: 0, fonts: 0 },
      frame: null,
      undrawn: [{ path: '/root/Main', meshTypes: ['EditorMesh'], isEmptyShape: false, shaderErrors: [] }],
      isSoftwareRendering: true,
    });
    view.dispose();
  });

  it('calls onStatusChange with the new status once the view reports a change', async () => {
    const onStatusChange = vi.fn();
    const view = await act(async () => sceneView({ onStatusChange }));

    expect(onStatusChange).toHaveBeenLastCalledWith(expect.objectContaining({ isSoftwareRendering: true }));
    view.dispose();
  });

  it('calls the onStatusChange an update gives, and stops calls once it is null', async () => {
    const first = vi.fn();
    const view = await act(async () => sceneView({ onStatusChange: first }));
    const second = vi.fn();
    await act(async () => view.update({ mode: 'in-game', onStatusChange: second }));
    await vi.waitFor(() =>
      expect(second).toHaveBeenLastCalledWith(
        expect.objectContaining({
          undrawn: [{ path: '/root/Main', meshTypes: ['GameMesh'], isEmptyShape: false, shaderErrors: [] }],
        })
      )
    );

    await act(async () => view.update({ onStatusChange: null }));
    second.mockClear();
    await act(async () => view.update({ mode: '3D' }));
    expect(second).not.toHaveBeenCalled();
    view.dispose();
  });
});
