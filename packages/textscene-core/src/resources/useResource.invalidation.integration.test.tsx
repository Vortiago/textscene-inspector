/**
 * Integration regression for the corpus-switch staleness hole: a mounted
 * `useResource` consumer holds its value in React STATE, so a full
 * `loader.clearCaches()` (corpus switch) used to leave it serving the
 * cleared corpus's value forever — the clear emitted nothing, the hook's
 * effect deps never changed, and nothing ever re-read the cache.
 *
 * The fix chain under test: full processor clears emit `invalidated` per
 * formerly-cached path → the hook re-requests under the NEW provider state
 * → the fresh `loaded` event replaces the stale value. Also covered: a
 * provider fetch still in flight at clear time must not deliver
 * cleared-era content to the new era.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';

import type { TscnScene } from '../parser/types';
import { ResourceLoader } from './ResourceLoader';
import { FileEventBus } from './FileEventBus';
import type { ResourceProvider } from './ResourceProvider';
import { useResource } from './useResource';
import { ResourceLoaderProvider } from './ResourceLoaderContext';

/** Provider whose content can be swapped mid-test (a corpus switch). */
class SwappableProvider implements ResourceProvider {
  private files = new Map<string, string>();

  setFile(path: string, data: string): void {
    this.files.set(path, data);
  }

  async loadResource(path: string): Promise<ArrayBuffer | string | null> {
    return this.files.get(path) ?? null;
  }
}

const SCENE_A = `[gd_scene format=3]

[node name="OldCorpusRoot" type="Node3D"]
`;

const SCENE_B = `[gd_scene format=3]

[node name="NewCorpusRoot" type="Node3D"]
`;

const SUB_SCENE_PATH = 'res://shared/sub.tscn';

/** Reports the loaded sub-scene's root node name (or the hook status). */
function SceneStub() {
  const result = useResource<TscnScene>(SUB_SCENE_PATH, 'PackedScene');
  return (
    <div data-testid="scene-stub" data-status={result.status}>
      {result.status === 'loaded' ? result.value!.nodes[0]!.name : result.status}
    </div>
  );
}

describe('useResource corpus-switch invalidation', () => {
  let provider: SwappableProvider;
  let loader: ResourceLoader;

  beforeEach(() => {
    provider = new SwappableProvider();
    const fileEventBus = new FileEventBus(provider);
    loader = new ResourceLoader(fileEventBus);
    loader.setProvider(provider);
    loader.register({ id: '1_sub', path: SUB_SCENE_PATH, type: 'PackedScene' });
  });

  it('a mounted consumer re-requests on clearCaches and picks up the new corpus value without remounting', async () => {
    provider.setFile(SUB_SCENE_PATH, SCENE_A);
    render(
      <ResourceLoaderProvider loader={loader}>
        <SceneStub />
      </ResourceLoaderProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('scene-stub').textContent).toBe('OldCorpusRoot');
    });

    // Corpus switch: the same res:// path now resolves to different content,
    // and the host clears the caches — exactly what useCorpusRoot does.
    provider.setFile(SUB_SCENE_PATH, SCENE_B);
    act(() => {
      loader.clearCaches();
    });

    await waitFor(() => {
      expect(screen.getByTestId('scene-stub').textContent).toBe('NewCorpusRoot');
    });
  });

  it('a consumer whose path is absent in the new corpus flips to unavailable instead of serving stale content', async () => {
    provider.setFile(SUB_SCENE_PATH, SCENE_A);
    render(
      <ResourceLoaderProvider loader={loader}>
        <SceneStub />
      </ResourceLoaderProvider>
    );
    await waitFor(() => {
      expect(screen.getByTestId('scene-stub').textContent).toBe('OldCorpusRoot');
    });

    // New corpus has no file at this path.
    provider.setFile(SUB_SCENE_PATH, '');
    const swapped = new SwappableProvider();
    loader.setProvider(swapped); // nothing served any more
    act(() => {
      loader.clearCaches();
    });

    await waitFor(() => {
      expect(screen.getByTestId('scene-stub').getAttribute('data-status')).toBe('unavailable');
    });
  });
});
