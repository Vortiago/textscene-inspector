import { afterEach, describe, expect, it, vi } from 'vitest';
import { mountScene } from './mountScene';
import { openScene } from '../scene/openScene';
import type { ResourceProvider } from '../resources/ResourceProvider';
import * as logger from '../logger';

const NO_FILES: ResourceProvider = { loadResource: async () => null };
const SCENE = '[gd_scene format=3]\n\n[node name="Main" type="Node2D"]\n';

function element(): HTMLElement {
  const host = document.createElement('div');
  document.body.append(host);
  return host;
}

afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

describe('mountScene', () => {
  it.each(['3D', '2D'] as const)('waits for a %s view to settle, as for an In-game one', async (mode) => {
    const view = mountScene(element(), openScene({ source: SCENE, provider: NO_FILES }), { mode });
    const settled = view.settled;
    view.dispose();
    await expect(settled).rejects.toThrow('expected the view to settle before its dispose');
  });

  it('rejects settled and captureImage with the error of a view that fails to mount', async () => {
    vi.spyOn(logger, 'error').mockImplementation(() => {});
    const view = mountScene(element(), openScene({ source: 'not a scene', provider: NO_FILES }));
    await expect(view.settled).rejects.toThrow(/^expected the view to mount, got .*\.tscn scene/);
    await expect(view.captureImage()).rejects.toThrow(/^expected the view to mount/);
    view.dispose();
  });

  it('rejects a pending settled once the view is disposed, and leaves the scene open', async () => {
    const scene = openScene({ source: SCENE, provider: NO_FILES });
    const view = mountScene(element(), scene);
    const settled = view.settled;
    view.dispose();
    await expect(settled).rejects.toThrow('expected the view to settle before its dispose');
    expect(scene.written()).not.toBeNull();
  });
});
