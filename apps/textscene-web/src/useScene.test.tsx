import { StrictMode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import type { ResourceProvider, Scene } from '@textscene/renderer';
import { useScene } from './useScene';

/** The scenes `openScene` gave and nothing has disposed yet. */
const openScenes = new Set<Scene>();
vi.mock('@textscene/renderer', async (importOriginal) => {
  const renderer = await importOriginal<typeof import('@textscene/renderer')>();
  return {
    ...renderer,
    openScene: (...args: Parameters<typeof renderer.openScene>) => {
      const scene = renderer.openScene(...args);
      openScenes.add(scene);
      const dispose = scene.dispose.bind(scene);
      return Object.assign(scene, { dispose: () => (openScenes.delete(scene), dispose()) });
    },
  };
});

const NO_FILES: ResourceProvider = { loadResource: async () => null };
const SCENE = '[gd_scene format=3]\n\n[node name="Main" type="Node3D"]\n';

function Preview({ provider = NO_FILES }: { provider?: ResourceProvider }) {
  const scene = useScene(SCENE, provider, 'res://main.tscn');
  return <p>{scene?.rootScenePath}</p>;
}

describe('useScene', () => {
  beforeEach(() => openScenes.clear());

  it('leaves no scene open once the previewer unmounts, under strict mode too', () => {
    const { unmount } = render(
      <StrictMode>
        <Preview />
      </StrictMode>
    );
    unmount();
    expect(openScenes.size).toBe(0);
  });

  it('disposes the scene of the provider it replaces', () => {
    const { rerender } = render(<Preview />);
    rerender(<Preview provider={{ loadResource: async () => null }} />);
    expect(openScenes.size).toBe(1);
  });
});
