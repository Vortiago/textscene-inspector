import { act } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mountScene } from './mountScene';
import { openScene } from '../scene/openScene';
import type { ResourceProvider } from '../resources/ResourceProvider';

// A happy-dom render creates no WebGL context, so no stage mounts its camera.
vi.mock('@react-three/fiber', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@react-three/fiber')>()),
  Canvas: () => <canvas />,
}));

vi.mock('./components/Canvas2DStage/Canvas2DStage', () => ({
  Canvas2DStage: () => <div data-stage="2D" />,
}));

const NO_FILES: ResourceProvider = { loadResource: async () => null };
const SCENE = '[gd_scene format=3]\n\n[node name="Main" type="Node3D"]\n';

async function mounted(options?: Parameters<typeof mountScene>[2]) {
  const host = document.createElement('div');
  document.body.append(host);
  const scene = openScene({ source: SCENE, provider: NO_FILES });
  const view = await act(async () => mountScene(host, scene, options));
  return { scene, view };
}

afterEach(() => {
  document.body.replaceChildren();
});

describe('the editor camera of a mounted view', () => {
  it('is null in the In-game mode, which draws through the game’s camera', async () => {
    const { view } = await mounted();

    expect(view.editorCamera).toBeNull();
    view.dispose();
  });

  it.each([
    ['3D', 'Camera3D'],
    ['2D', 'Camera2D'],
  ] as const)('is a %s mode’s own %s', async (mode, type) => {
    const { view } = await mounted({ mode });

    expect(view.editorCamera?.type).toBe(type);
    view.dispose();
  });

  it('follows a switch of the mode', async () => {
    const { view } = await mounted({ mode: '3D' });

    await act(async () => view.update({ mode: '2D' }));
    expect(view.editorCamera?.type).toBe('Camera2D');
    await act(async () => view.update({ mode: 'in-game' }));
    expect(view.editorCamera).toBeNull();
    view.dispose();
  });

  it('is one node per mode for the life of the view', async () => {
    const { view } = await mounted({ mode: '3D' });
    const camera3D = view.editorCamera;

    await act(async () => view.update({ mode: '2D' }));
    await act(async () => view.update({ mode: '3D' }));

    expect(view.editorCamera).toBe(camera3D);
    view.dispose();
  });

  it('is no node of the scene', async () => {
    const { scene, view } = await mounted({ mode: '3D' });
    const camera = view.editorCamera!;

    expect(scene.getNodeOrNull(camera.path)).toBeNull();
    expect(camera.getParent()).toBeNull();
    expect(camera.getChildren()).toEqual([]);
    expect([...scene.cameras().keys()]).toEqual([]);
    view.dispose();
  });

  it('refuses a read once the view is disposed', async () => {
    const { view } = await mounted({ mode: '3D' });
    const camera = view.editorCamera!;

    view.dispose();

    await expect(camera.get('fov')).rejects.toThrow('expected a mounted view, got a disposed one');
    expect(camera.isInsideTree()).toBe(false);
  });
});
