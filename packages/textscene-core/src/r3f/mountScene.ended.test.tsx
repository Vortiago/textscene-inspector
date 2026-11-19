import { afterEach, describe, expect, it, vi } from 'vitest';
import { mountScene } from './mountScene';
import { openScene } from '../scene/openScene';
import type { ResourceProvider } from '../resources/ResourceProvider';

vi.mock('./viewStatus/viewStatus', async (importOriginal) => {
  const original = await importOriginal<typeof import('./viewStatus/viewStatus')>();
  return {
    ...original,
    // A status that still holds a settled frame, as before React has unmounted an ended view.
    createViewStatus: () => ({
      ...original.createViewStatus(),
      whenSettled: () => Promise.resolve({ scriptedNodeCount: 0, hasCurrentCamera: false }),
    }),
  };
});

const NO_FILES: ResourceProvider = { loadResource: async () => null };
const SCENE = '[gd_scene format=3]\n\n[node name="Main" type="Node2D"]\n';

afterEach(() => document.body.replaceChildren());

describe('mountScene after the view ends', () => {
  it('rejects a new read of settled though the status still holds a settled frame', async () => {
    const host = document.createElement('div');
    document.body.append(host);
    const view = mountScene(host, openScene({ source: SCENE, provider: NO_FILES }));
    view.dispose();
    await expect(view.settled).rejects.toThrow('expected the view to settle before its dispose');
  });
});
