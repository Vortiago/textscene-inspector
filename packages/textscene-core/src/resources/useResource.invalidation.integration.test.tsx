/**
 * A mounted `useResource` consumer holds its value in React state, so a corpus switch must reach
 * it: `ResourceLoader.clearCaches`, the one announcer, emits `invalidated` per dropped path, the
 * hook requests again, and the fresh `loaded` event replaces the value. Also covered: the
 * announcement order, a load in flight at the clear, and a path absent from the new corpus.
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
  /** When set, the NEXT loadResource call blocks until `releaseGate()`. */
  private gate: Promise<void> | null = null;
  private openGate: (() => void) | null = null;

  setFile(path: string, data: string): void {
    this.files.set(path, data);
  }

  armGate(): void {
    this.gate = new Promise((r) => (this.openGate = r));
  }

  releaseGate(): void {
    this.openGate?.();
    this.openGate = null;
  }

  async loadResource(path: string): Promise<ArrayBuffer | string | null> {
    if (this.gate) {
      const gate = this.gate;
      this.gate = null; // only the next call blocks
      await gate;
    }
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
  const result = useResource<TscnScene>(SUB_SCENE_PATH, 'scene');
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
    // and the host clears the caches, as useCorpusRoot does.
    provider.setFile(SUB_SCENE_PATH, SCENE_B);
    act(() => {
      loader.clearCaches();
    });

    await waitFor(() => {
      expect(screen.getByTestId('scene-stub').textContent).toBe('NewCorpusRoot');
    });
  });

  it('clearCaches announces only after EVERY layer is reset — a re-entrant re-request observes empty caches', async () => {
    provider.setFile(SUB_SCENE_PATH, SCENE_A);
    loader.scenes.request(SUB_SCENE_PATH);
    await waitFor(() => {
      expect(loader.scenes.isCached(SUB_SCENE_PATH)).toBe(true);
    });

    // Handlers run inside clearCaches' announcement loop and see reset caches but present metadata:
    // a scene load validates its registration at request time, and these consumers' register
    // effects do not run again.
    const observed: { sceneCached: boolean; metadataPresent: boolean }[] = [];
    loader.eventBus.on('scene', 'invalidated', (path) => {
      observed.push({
        sceneCached: loader.scenes.isCached(path),
        metadataPresent: loader.metadata.get(path) !== undefined,
      });
    });

    loader.clearCaches();

    expect(observed).toEqual([{ sceneCached: false, metadataPresent: true }]);
    // Once the announcement loop finishes, the metadata is gone too.
    expect(loader.metadata.get(SUB_SCENE_PATH)).toBeUndefined();
  });

  it('a consumer whose load is IN FLIGHT at clear time is announced too — it heals instead of hanging pending forever', async () => {
    // The old scene's fetch is still in flight at the switch, and its completion is dropped, so
    // only the in-flight announcement reaches the consumer.
    provider.setFile(SUB_SCENE_PATH, SCENE_A);
    provider.armGate();
    render(
      <ResourceLoaderProvider loader={loader}>
        <SceneStub />
      </ResourceLoaderProvider>
    );
    await waitFor(() => {
      expect(screen.getByTestId('scene-stub').getAttribute('data-status')).toBe('pending');
    });

    // Corpus switch mid-flight; the announced re-request fetches SCENE_B.
    provider.setFile(SUB_SCENE_PATH, SCENE_B);
    act(() => {
      loader.clearCaches();
    });
    provider.releaseGate(); // the stale flight resolves and must be dropped

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
